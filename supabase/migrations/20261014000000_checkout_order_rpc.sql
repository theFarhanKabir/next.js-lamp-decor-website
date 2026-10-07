-- Atomically create an order and its lines. The Node API validates customer
-- input and re-reads product pricing; this function protects stock and keeps
-- order plus line-item writes in a single database transaction.

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
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the trusted backend can create orders';
  end if;
  if jsonb_typeof(order_data) <> 'object' or jsonb_typeof(item_data) <> 'array' then
    raise exception 'Invalid order payload';
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_email, customer_phone,
    status, payment_status, payment_method, shipping_address,
    subtotal_bdt, delivery_fee_bdt, discount_bdt, total_bdt, customer_note
  ) values (
    nullif(order_data ->> 'customer_id', '')::uuid,
    order_data ->> 'customer_name',
    order_data ->> 'customer_email',
    order_data ->> 'customer_phone',
    'pending', 'pending', order_data ->> 'payment_method',
    coalesce(order_data -> 'shipping_address', '{}'::jsonb),
    (order_data ->> 'subtotal_bdt')::numeric,
    coalesce((order_data ->> 'delivery_fee_bdt')::numeric, 0),
    coalesce((order_data ->> 'discount_bdt')::numeric, 0),
    (order_data ->> 'total_bdt')::numeric,
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
    if line.quantity is null or line.quantity < 1 then
      raise exception 'Order item quantity must be positive';
    end if;
    if line.product_id is not null then
      select product.inventory_quantity, product.track_inventory, product.made_to_order, product.status
        into current_stock, should_track, made_to_order, current_status
      from public.products as product
      where product.id = line.product_id
      for update;
      if not found or current_status <> 'active' then
        raise exception 'A product in this order is no longer available';
      end if;
      if should_track and not made_to_order then
        if current_stock < line.quantity then
          raise exception 'There is not enough product inventory to complete this order';
        end if;
        update public.products
          set inventory_quantity = inventory_quantity - line.quantity,
              updated_at = now()
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

  return jsonb_build_object('id', created_id, 'order_number', created_number);
end;
$$;

revoke all on function public.create_store_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_store_order(jsonb, jsonb) to service_role;

create or replace function public.restore_cancelled_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('cancelled', 'refunded') and new.status not in ('cancelled', 'refunded') then
    raise exception 'A cancelled or refunded order cannot be reopened';
  end if;
  if new.status in ('cancelled', 'refunded') and old.status not in ('cancelled', 'refunded') then
    update public.products as product
      set inventory_quantity = product.inventory_quantity + item.total_quantity,
          updated_at = now()
    from (
      select order_item.product_id, sum(order_item.quantity)::integer as total_quantity
      from public.order_items as order_item
      where order_item.order_id = old.id and order_item.product_id is not null
      group by order_item.product_id
    ) as item
    where product.id = item.product_id
      and product.track_inventory
      and not product.made_to_order;
  end if;
  return new;
end;
$$;

drop trigger if exists restore_inventory_when_order_cancelled on public.orders;
create trigger restore_inventory_when_order_cancelled
before update of status on public.orders
for each row execute function public.restore_cancelled_order_inventory();
