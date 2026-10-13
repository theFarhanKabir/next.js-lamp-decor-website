-- Persistent signed-in cart/wishlist, atomic coupons/rewards, and payment records.

create table if not exists public.customer_storefront_state (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  cart_items jsonb not null default '[]'::jsonb,
  wishlist_product_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(cart_items) = 'array' and jsonb_array_length(cart_items) <= 100),
  check (jsonb_typeof(wishlist_product_ids) = 'array' and jsonb_array_length(wishlist_product_ids) <= 300)
);

alter table public.customer_storefront_state enable row level security;
grant select, insert, update, delete on public.customer_storefront_state to authenticated;
drop policy if exists "customers manage own storefront state" on public.customer_storefront_state;
create policy "customers manage own storefront state" on public.customer_storefront_state
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

alter table public.orders
  add column if not exists reward_points_redeemed integer not null default 0 check (reward_points_redeemed >= 0),
  add column if not exists reward_points_earned integer not null default 0 check (reward_points_earned >= 0),
  add column if not exists rewards_reversed boolean not null default false;

alter table public.reward_accounts
  add column if not exists points_debt integer not null default 0 check (points_debt >= 0);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider = 'sslcommerz'),
  provider_transaction_id text not null unique,
  provider_validation_id text unique,
  amount_bdt numeric(12,2) not null check (amount_bdt > 0),
  currency text not null default 'BDT' check (currency = 'BDT'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  gateway_session_key text,
  risk_level integer check (risk_level is null or risk_level in (0, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_transactions_order_idx on public.payment_transactions(order_id, created_at desc);
alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from anon, authenticated;
grant all on public.payment_transactions to service_role;

create or replace function public.create_store_order(order_data jsonb, item_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  created_number bigint;
  line record;
  current_stock integer;
  should_track boolean;
  made_to_order boolean;
  current_status public.product_status;
  customer_id_value uuid;
  order_subtotal numeric(12,2);
  delivery_fee numeric(12,2);
  coupon_record public.coupons%rowtype;
  coupon_code_value text;
  coupon_discount numeric(12,2) := 0;
  reward_discount numeric(12,2) := 0;
  total_discount numeric(12,2) := 0;
  order_total numeric(12,2);
  rewards_config jsonb := '{}'::jsonb;
  rewards_enabled boolean := false;
  reward_unit_points integer := 0;
  reward_unit_value numeric(12,2) := 0;
  reward_points_available integer := 0;
  reward_points_to_redeem integer := 0;
  reward_balance integer := 0;
  reward_debt integer := 0;
  payment_transaction_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the trusted backend can create orders';
  end if;
  if jsonb_typeof(order_data) <> 'object' or jsonb_typeof(item_data) <> 'array'
     or jsonb_array_length(item_data) < 1 or jsonb_array_length(item_data) > 30 then
    raise exception 'Invalid order payload';
  end if;

  customer_id_value := nullif(order_data ->> 'customer_id', '')::uuid;
  order_subtotal := round(coalesce((
    select sum((entry.value ->> 'line_total_bdt')::numeric)
    from jsonb_array_elements(item_data) as entry(value)
  ), 0), 2);
  if order_subtotal <= 0 or order_subtotal <> round((order_data ->> 'subtotal_bdt')::numeric, 2) then
    raise exception 'The order subtotal does not match its items';
  end if;
  delivery_fee := round(coalesce((order_data ->> 'delivery_fee_bdt')::numeric, 0), 2);
  if delivery_fee < 0 then raise exception 'Invalid delivery fee'; end if;
  if coalesce(order_data ->> 'payment_method', '') not in ('card', 'bkash', 'cod') then
    raise exception 'Invalid payment method';
  end if;

  coupon_code_value := nullif(upper(btrim(coalesce(order_data ->> 'coupon_code', ''))), '');
  if coupon_code_value is not null then
    select * into coupon_record
      from public.coupons as coupon
      where upper(coupon.code) = coupon_code_value
      for update;
    if not found or not coupon_record.is_active then raise exception 'This coupon is not available'; end if;
    if coupon_record.starts_at is not null and coupon_record.starts_at > now() then raise exception 'This coupon is not active yet'; end if;
    if coupon_record.ends_at is not null and coupon_record.ends_at <= now() then raise exception 'This coupon has expired'; end if;
    if order_subtotal < coupon_record.minimum_order_bdt then raise exception 'The order does not meet this coupon minimum'; end if;
    if coupon_record.usage_limit is not null and coupon_record.usage_count >= coupon_record.usage_limit then raise exception 'This coupon has reached its usage limit'; end if;
    if coupon_record.discount_type = 'percentage' then
      coupon_discount := least(order_subtotal, round(order_subtotal * coupon_record.discount_value / 100, 2));
    else
      coupon_discount := least(order_subtotal, coupon_record.discount_value);
    end if;
  end if;

  select value into rewards_config from public.store_settings where key = 'rewards';
  rewards_enabled := coalesce((rewards_config ->> 'enabled')::boolean, false);
  reward_unit_points := coalesce((rewards_config ->> 'redemption_points')::integer, 0);
  reward_unit_value := coalesce((rewards_config ->> 'redemption_value_bdt')::numeric, 0);
  if coalesce((order_data ->> 'redeem_rewards')::boolean, false) then
    if customer_id_value is null then raise exception 'Sign in to redeem reward points'; end if;
    if rewards_enabled and reward_unit_points > 0 and reward_unit_value > 0 then
      insert into public.reward_accounts (customer_id) values (customer_id_value) on conflict (customer_id) do nothing;
      select points_balance, points_debt into reward_balance, reward_debt
        from public.reward_accounts where customer_id = customer_id_value for update;
      reward_points_available := greatest(reward_balance - reward_debt, 0);
      reward_points_to_redeem := least(
        (reward_points_available / reward_unit_points) * reward_unit_points,
        floor(greatest(order_subtotal - coupon_discount, 0) / reward_unit_value)::integer * reward_unit_points
      );
      reward_discount := (reward_points_to_redeem / reward_unit_points) * reward_unit_value;
    end if;
  end if;

  total_discount := round(coupon_discount + reward_discount, 2);
  order_total := round(order_subtotal + delivery_fee - total_discount, 2);
  if order_total < 0 then raise exception 'The order total is invalid'; end if;
  payment_transaction_id := nullif(order_data ->> 'payment_transaction_id', '');
  if order_data ->> 'payment_method' in ('card', 'bkash') then
    if order_total < 10 or order_total > 500000 then raise exception 'Online payment totals must be between BDT 10 and BDT 500,000'; end if;
    if payment_transaction_id is null or length(payment_transaction_id) > 30 then raise exception 'A valid payment transaction ID is required'; end if;
  elsif payment_transaction_id is not null then
    raise exception 'Cash on delivery cannot create an online payment transaction';
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_email, customer_phone,
    status, payment_status, payment_method, shipping_address,
    subtotal_bdt, delivery_fee_bdt, discount_bdt, total_bdt, coupon_id,
    reward_points_redeemed, customer_note
  ) values (
    customer_id_value,
    order_data ->> 'customer_name',
    order_data ->> 'customer_email',
    order_data ->> 'customer_phone',
    'pending', 'pending', order_data ->> 'payment_method',
    coalesce(order_data -> 'shipping_address', '{}'::jsonb),
    order_subtotal, delivery_fee, total_discount, order_total,
    coupon_record.id, reward_points_to_redeem,
    nullif(order_data ->> 'customer_note', '')
  ) returning id, order_number into created_id, created_number;

  for line in
    select * from jsonb_to_recordset(item_data) as item(
      product_id uuid,
      product_name text,
      product_sku text,
      selected_options jsonb,
      unit_price_bdt numeric,
      quantity integer,
      line_total_bdt numeric
    )
  loop
    if line.quantity is null or line.quantity < 1 or line.quantity > 50
       or line.unit_price_bdt is null or line.unit_price_bdt < 0
       or line.line_total_bdt is null or line.line_total_bdt <> round(line.unit_price_bdt * line.quantity, 2) then
      raise exception 'Invalid order item amount or quantity';
    end if;
    if line.product_id is not null then
      select product.inventory_quantity, product.track_inventory, product.made_to_order, product.status
        into current_stock, should_track, made_to_order, current_status
      from public.products as product
      where product.id = line.product_id
      for update;
      if not found or current_status <> 'active' then raise exception 'A product in this order is no longer available'; end if;
      if should_track and not made_to_order then
        if current_stock < line.quantity then raise exception 'There is not enough product inventory to complete this order'; end if;
        update public.products
          set inventory_quantity = inventory_quantity - line.quantity, updated_at = now()
          where id = line.product_id;
      end if;
    end if;
    insert into public.order_items (
      order_id, product_id, product_name, product_sku, selected_options,
      unit_price_bdt, quantity, line_total_bdt
    ) values (
      created_id, line.product_id, line.product_name, line.product_sku,
      coalesce(line.selected_options, '{}'::jsonb), line.unit_price_bdt,
      line.quantity, line.line_total_bdt
    );
  end loop;

  if coupon_code_value is not null then
    update public.coupons set usage_count = usage_count + 1 where id = coupon_record.id;
  end if;
  if reward_points_to_redeem > 0 then
    update public.reward_accounts set points_balance = points_balance - reward_points_to_redeem, updated_at = now()
      where customer_id = customer_id_value;
    insert into public.reward_ledger (customer_id, points_delta, reason, order_id)
      values (customer_id_value, -reward_points_to_redeem, 'order_redemption', created_id);
  end if;
  if payment_transaction_id is not null then
    insert into public.payment_transactions (
      order_id, provider, provider_transaction_id, amount_bdt, currency
    ) values (
      created_id, 'sslcommerz', payment_transaction_id, order_total, 'BDT'
    );
  end if;

  return jsonb_build_object(
    'id', created_id,
    'order_number', created_number,
    'subtotal_bdt', order_subtotal,
    'discount_bdt', total_discount,
    'coupon_discount_bdt', coupon_discount,
    'reward_discount_bdt', reward_discount,
    'reward_points_redeemed', reward_points_to_redeem,
    'total_bdt', order_total
  );
end;
$$;

revoke all on function public.create_store_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_store_order(jsonb, jsonb) to service_role;

create or replace function public.settle_store_payment(
  transaction_id text,
  validation_id text,
  validated_amount numeric,
  validated_currency text,
  validated_status text,
  validated_risk integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payment_transactions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Only the trusted backend can settle a payment'; end if;
  select * into payment from public.payment_transactions
    where provider_transaction_id = transaction_id for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  if payment.status = 'paid' then
    if payment.provider_validation_id = validation_id then
      return jsonb_build_object('ok', true, 'order_id', payment.order_id, 'already_paid', true);
    end if;
    raise exception 'Payment transaction was already settled';
  end if;
  if payment.status <> 'pending' then raise exception 'Payment transaction is not pending'; end if;
  if validated_status not in ('VALID', 'VALIDATED') or validated_currency <> 'BDT'
     or round(validated_amount, 2) <> payment.amount_bdt or validated_risk not in (0, 1) then
    raise exception 'Payment validation did not match the pending order';
  end if;
  update public.payment_transactions
    set status = 'paid', provider_validation_id = validation_id, risk_level = validated_risk, updated_at = now()
    where id = payment.id;
  update public.orders
    set payment_status = 'paid', status = case when validated_risk = 0 then 'confirmed'::public.order_status else status end, updated_at = now()
    where id = payment.order_id and payment_status = 'pending' and status = 'pending';
  if not found then raise exception 'The related order is no longer pending'; end if;
  return jsonb_build_object('ok', true, 'order_id', payment.order_id, 'already_paid', false, 'risk_review', validated_risk = 1);
end;
$$;

revoke all on function public.settle_store_payment(text, text, numeric, text, text, integer) from public, anon, authenticated;
grant execute on function public.settle_store_payment(text, text, numeric, text, text, integer) to service_role;

create or replace function public.close_store_payment(transaction_id text, final_status text, validated_amount numeric, validated_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payment_transactions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Only the trusted backend can close a payment'; end if;
  if final_status not in ('failed', 'cancelled') then raise exception 'Invalid final payment status'; end if;
  select * into payment from public.payment_transactions
    where provider_transaction_id = transaction_id for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  if payment.status = final_status then return jsonb_build_object('ok', true, 'already_closed', true); end if;
  if payment.status <> 'pending' then raise exception 'Payment transaction is not pending'; end if;
  if validated_currency <> 'BDT' or round(validated_amount, 2) <> payment.amount_bdt then
    raise exception 'Payment verification did not match the pending order';
  end if;
  update public.payment_transactions set status = final_status, updated_at = now() where id = payment.id;
  update public.orders set status = 'cancelled', payment_status = 'failed', updated_at = now()
    where id = payment.order_id and status = 'pending' and payment_status = 'pending';
  if not found then raise exception 'The related order is no longer pending'; end if;
  return jsonb_build_object('ok', true, 'already_closed', false);
end;
$$;

revoke all on function public.close_store_payment(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.close_store_payment(text, text, numeric, text) to service_role;

create or replace function public.close_pending_order_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') then
    update public.payment_transactions set status = 'cancelled', updated_at = now()
      where order_id = old.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists close_pending_order_payment on public.orders;
create trigger close_pending_order_payment before update of status on public.orders
  for each row execute function public.close_pending_order_payment();

create or replace function public.apply_order_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_config jsonb := '{}'::jsonb;
  points_rate integer := 0;
  points_to_earn integer := 0;
  available_balance integer := 0;
  current_debt integer := 0;
  debt_paid integer := 0;
  restore_points integer := 0;
  remove_points integer := 0;
begin
  if new.customer_id is not null and new.status = 'delivered' and old.status is distinct from 'delivered'
     and (new.payment_status = 'paid' or new.payment_method = 'cod') then
    if new.payment_method = 'cod' and new.payment_status <> 'paid' then new.payment_status := 'paid'; end if;
    select value into reward_config from public.store_settings where key = 'rewards';
    points_rate := coalesce((reward_config ->> 'points_per_100_bdt')::integer, 0);
    if coalesce((reward_config ->> 'enabled')::boolean, false) and points_rate > 0 then
      points_to_earn := greatest(0, floor(greatest(new.subtotal_bdt - new.discount_bdt, 0) / 100)::integer * points_rate);
      if points_to_earn > 0 then
        insert into public.reward_accounts (customer_id) values (new.customer_id) on conflict (customer_id) do nothing;
        select points_balance, points_debt into available_balance, current_debt
          from public.reward_accounts where customer_id = new.customer_id for update;
        debt_paid := least(current_debt, points_to_earn);
        update public.reward_accounts
          set points_balance = points_balance + points_to_earn - debt_paid,
              points_debt = points_debt - debt_paid,
              updated_at = now()
          where customer_id = new.customer_id;
        insert into public.reward_ledger (customer_id, points_delta, reason, order_id)
          values (new.customer_id, points_to_earn, 'order_earned', new.id);
        update public.orders set reward_points_earned = points_to_earn where id = new.id;
        new.reward_points_earned := points_to_earn;
      end if;
    end if;
  end if;

  if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') then
    update public.coupons set usage_count = greatest(usage_count - 1, 0)
      where id = new.coupon_id and new.coupon_id is not null and usage_count > 0;
    if new.customer_id is not null and not new.rewards_reversed
       and (new.reward_points_redeemed > 0 or new.reward_points_earned > 0) then
      insert into public.reward_accounts (customer_id) values (new.customer_id) on conflict (customer_id) do nothing;
      select points_balance, points_debt into available_balance, current_debt
        from public.reward_accounts where customer_id = new.customer_id for update;
      restore_points := new.reward_points_redeemed;
      debt_paid := least(current_debt, restore_points);
      update public.reward_accounts
        set points_balance = points_balance + restore_points - debt_paid,
            points_debt = points_debt - debt_paid,
            updated_at = now()
        where customer_id = new.customer_id;
      if restore_points > 0 then
        insert into public.reward_ledger (customer_id, points_delta, reason, order_id)
          values (new.customer_id, restore_points, 'order_redemption_reversed', new.id);
      end if;
      remove_points := least(available_balance + restore_points - debt_paid, new.reward_points_earned);
      if new.reward_points_earned > 0 then
        update public.reward_accounts
          set points_balance = greatest(points_balance - remove_points, 0),
              points_debt = points_debt + greatest(new.reward_points_earned - remove_points, 0),
              updated_at = now()
          where customer_id = new.customer_id;
        insert into public.reward_ledger (customer_id, points_delta, reason, order_id)
          values (new.customer_id, -new.reward_points_earned, 'order_earning_reversed', new.id);
      end if;
      new.rewards_reversed := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_order_rewards on public.orders;
create trigger apply_order_rewards before update of status on public.orders
  for each row execute function public.apply_order_rewards();

-- Persist the current storefront defaults once; any saved admin configuration wins.
insert into public.store_settings (key, value)
values ('homepage_content', '{"heroSlides":[{"image":"https://images.unsplash.com/photo-1721824296808-92c325601dd8?auto=format&fit=crop&w=1800&q=80","alt":"Warmly lit interior with considered lighting","eyebrow":"THE SHADE EDIT","headline":"Quiet forms.\nBeautifully reflected.","subtext":"Thoughtful lighting and mirror details for a more balanced home.","ctaLabel":"Shop the collection","categorySlug":"all","active":true},{"image":"https://images.unsplash.com/photo-1540759772348-12e90305e8f4?auto=format&fit=crop&w=1800&q=80","alt":"A bright room featuring reflective surfaces","eyebrow":"MIRRORS THAT OPEN A ROOM","headline":"Let the light\nfind its way in.","subtext":"Reflective forms and finely finished frames for everyday spaces.","ctaLabel":"Shop the collection","categorySlug":"all","active":true},{"image":"https://images.unsplash.com/photo-1716593145277-36e92b658bfe?auto=format&fit=crop&w=1800&q=80","alt":"Layered lighting in a calm interior","eyebrow":"LIGHT, LAYERED","headline":"A softer light\nfor quieter rooms.","subtext":"Sculptural lamps and considered mirrors in calm, cool tones.","ctaLabel":"Shop the collection","categorySlug":"all","active":true}],"categories":[{"name":"Lamps","image":"https://images.unsplash.com/photo-1778880707611-d1f09e32b4e2?auto=format&fit=crop&w=600&q=80","alt":"Table and pendant lamps","slug":"lighting","active":true},{"name":"Mirrors","image":"https://images.unsplash.com/photo-1542485028-6e019f9c8a8e?auto=format&fit=crop&w=600&q=80","alt":"Decorative wall mirror","slug":"mirrors","active":true},{"name":"Tables","image":"https://images.unsplash.com/photo-1784651859128-b04c1d4732f3?auto=format&fit=crop&w=600&q=80","alt":"Oak furniture table","slug":"tables","active":true},{"name":"Shades","image":"https://images.unsplash.com/photo-1774444052266-2e4b58d85c3b?auto=format&fit=crop&w=600&q=80","alt":"Decorative lamp shade","slug":"shades","active":true},{"name":"New Arrivals","image":"https://images.unsplash.com/photo-1775667693473-91e07000bb1a?auto=format&fit=crop&w=600&q=80","alt":"New lighting collection","slug":"new","active":true},{"name":"Sale","image":"https://images.unsplash.com/photo-1542485028-6e019f9c8a8e?auto=format&fit=crop&w=600&q=80","alt":"Furniture on sale","slug":"sale","active":true}],"hotDeals":[{"productId":"arc-floor-lamp","name":"Arc Brass Floor Lamp","category":"Floor Lamps","price":115000,"was":138000,"image":"https://images.unsplash.com/photo-1775667693473-91e07000bb1a?auto=format&fit=crop&w=700&q=80","alt":"Arc floor lamp in a reading nook","active":true},{"productId":"marlow-table-lamp","name":"Marlow Ceramic Table Lamp","category":"Table Lamps","price":42000,"was":52000,"image":"https://images.unsplash.com/photo-1564540574859-0dfb63985953?auto=format&fit=crop&w=700&q=80","alt":"Ceramic table lamp","active":true},{"productId":"solis-pendant","name":"Solis Dome Pendant","category":"Pendant Lights","price":58000,"was":72000,"image":"https://images.unsplash.com/photo-1778880707611-d1f09e32b4e2?auto=format&fit=crop&w=700&q=80","alt":"Dome pendant light","active":true},{"productId":"cleo-wall-sconce","name":"Cleo Brass Wall Sconce","category":"Wall Lights","price":36000,"was":45000,"image":"https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=700&q=80","alt":"Brass wall sconce","active":true},{"productId":"solene-wall-mirror","name":"Solene Arched Mirror","category":"Wall Mirrors","price":68000,"was":82000,"image":"https://images.unsplash.com/photo-1542485028-6e019f9c8a8e?auto=format&fit=crop&w=700&q=80","alt":"Arched wall mirror","active":true},{"productId":"mira-round-mirror","name":"Mira Round Mirror","category":"Mirrors","price":52000,"was":64000,"image":"https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=80","alt":"Round wall mirror","active":true},{"productId":"oslo-side-table","name":"Oslo Oak Side Table","category":"Side Tables","price":54000,"was":68000,"image":"https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=700&q=80","alt":"Oak side table","active":true},{"productId":"remy-marble-side-table","name":"Remy Marble Side Table","category":"Tables","price":76000,"was":92000,"image":"https://images.unsplash.com/photo-1784651859128-b04c1d4732f3?auto=format&fit=crop&w=700&q=80","alt":"Marble side table","active":true},{"productId":"iris-dining-table","name":"Iris Ash Dining Table","category":"Dining Tables","price":155000,"was":180000,"image":"https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=700&q=80","alt":"Ash dining table","active":true},{"productId":"cole-nesting-tables","name":"Cole Nesting Tables","category":"Nesting Tables","price":64000,"was":78000,"image":"https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=700&q=80","alt":"Nesting tables","active":true},{"productId":"isla-linen-lamp-shade","name":"Isla Linen Lampshade","category":"Lamp Shades","price":18000,"was":23000,"image":"https://images.unsplash.com/photo-1774444052266-2e4b58d85c3b?auto=format&fit=crop&w=700&q=80","alt":"Natural linen lampshade","active":true},{"productId":"marin-pleated-shade","name":"Marin Pleated Shade","category":"Lamp Shades","price":22000,"was":28000,"image":"https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=700&q=80","alt":"Pleated lampshade","active":true},{"productId":"luna-pendant","name":"Luna Opal Pendant","category":"Pendant Lights","price":58000,"was":70000,"image":"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=80","alt":"Opal glass pendant","active":true},{"productId":"nora-table-lamp","name":"Nora Glass Table Lamp","category":"Table Lamps","price":48000,"was":59000,"image":"https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=700&q=80","alt":"Glass table lamp","active":true},{"productId":"noor-velvet-shade","name":"Noor Velvet Lampshade","category":"Lamp Shades","price":26000,"was":32000,"image":"https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=700&q=80","alt":"Velvet lampshade","active":true}],"hotDealsActive":true,"newArrivals":{"title":"New Arrivals","eyebrow":"Just arrived","productIds":["milo-console-table","ellery-full-length-mirror","oslo-side-table","cleo-wall-sconce","solene-wall-mirror"],"active":true}}'::jsonb)
on conflict (key) do nothing;
