-- Audited, server-side status transitions for orders and custom requests.
create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.order_status_events to authenticated;
grant all on public.order_status_events to service_role;
create index if not exists order_status_events_order_date_idx on public.order_status_events(order_id, created_at desc);
alter table public.order_status_events enable row level security;
drop policy if exists "customer read own order status history or admin" on public.order_status_events;
create policy "customer read own order status history or admin" on public.order_status_events for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or lower(o.customer_email) = lower((select auth.jwt() ->> 'email')) or (select public.is_store_admin()))));

create table if not exists public.custom_request_status_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.custom_request_status_events to authenticated;
grant all on public.custom_request_status_events to service_role;
create index if not exists custom_request_status_events_request_date_idx on public.custom_request_status_events(request_id, created_at desc);
alter table public.custom_request_status_events enable row level security;
drop policy if exists "customer read own custom request history or admin" on public.custom_request_status_events;
create policy "customer read own custom request history or admin" on public.custom_request_status_events for select to authenticated
using (exists (select 1 from public.custom_requests r where r.id = request_id and (r.customer_id = (select auth.uid()) or (select public.is_store_admin()))));

create or replace function public.record_initial_workflow_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'orders' then
    insert into public.order_status_events(order_id,from_status,to_status,actor_user_id,actor_email,note)
      values (new.id,null,new.status::text,new.customer_id,'Customer checkout','Order received');
  else
    insert into public.custom_request_status_events(request_id,from_status,to_status,actor_user_id,actor_email,note)
      values (new.id,null,new.status::text,new.customer_id,'Customer','Request submitted');
  end if;
  return new;
end;
$$;
drop trigger if exists record_initial_order_status on public.orders;
create trigger record_initial_order_status after insert on public.orders for each row execute function public.record_initial_workflow_status();
drop trigger if exists record_initial_custom_request_status on public.custom_requests;
create trigger record_initial_custom_request_status after insert on public.custom_requests for each row execute function public.record_initial_workflow_status();
insert into public.order_status_events(order_id,from_status,to_status,actor_user_id,actor_email,note)
  select o.id,null,o.status::text,o.customer_id,'Historical record','Status at workflow rollout'
  from public.orders o where not exists (select 1 from public.order_status_events e where e.order_id=o.id);
insert into public.custom_request_status_events(request_id,from_status,to_status,actor_user_id,actor_email,note)
  select r.id,null,r.status::text,r.customer_id,'Historical record','Status at workflow rollout'
  from public.custom_requests r where not exists (select 1 from public.custom_request_status_events e where e.request_id=r.id);

create or replace function public.audit_workflow_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_id text; actor_name text; event_note text;
begin
  actor_id := nullif(current_setting('app.workflow_actor_id',true),'');
  actor_name := coalesce(nullif(current_setting('app.workflow_actor_email',true),''),case when tg_table_name='orders' then 'Payment or courier system' else 'System' end);
  event_note := nullif(current_setting('app.workflow_note',true),'');
  if tg_table_name='orders' then
    insert into public.order_status_events(order_id,from_status,to_status,actor_user_id,actor_email,note)
      values (new.id,old.status::text,new.status::text,actor_id::uuid,actor_name,event_note);
  else
    insert into public.custom_request_status_events(request_id,from_status,to_status,actor_user_id,actor_email,note)
      values (new.id,old.status::text,new.status::text,actor_id::uuid,actor_name,event_note);
  end if;
  return new;
end;
$$;
drop trigger if exists audit_order_status_change on public.orders;
create trigger audit_order_status_change after update of status on public.orders
  for each row when (old.status is distinct from new.status) execute function public.audit_workflow_status_change();
drop trigger if exists audit_custom_request_status_change on public.custom_requests;
create trigger audit_custom_request_status_change after update of status on public.custom_requests
  for each row when (old.status is distinct from new.status) execute function public.audit_workflow_status_change();

alter table public.orders add column if not exists payment_refund_reference text;
alter table public.payment_transactions drop constraint if exists payment_transactions_status_check;
alter table public.payment_transactions add constraint payment_transactions_status_check
  check (status in ('pending','paid','failed','cancelled','refunded'));

create or replace function public.admin_change_order_status(
  p_order_id uuid, p_status text, p_actor_user_id uuid, p_actor_email text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype; allowed boolean := false;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if p_status = current_order.status::text then return current_order; end if;
  allowed := case current_order.status::text
    when 'pending' then p_status in ('confirmed','cancelled')
    when 'confirmed' then p_status in ('processing','cancelled')
    when 'processing' then p_status in ('shipped','cancelled')
    when 'shipped' then p_status = 'delivered'
    else false end;
  if not allowed then raise exception 'That order status transition is not allowed.' using errcode = '22023'; end if;
  if p_status='cancelled' and current_order.courier_consignment_id is not null then
    raise exception 'Cancel the Steadfast shipment before cancelling this order. Shipment cancellation is not available here yet.' using errcode = '22023';
  end if;
  if p_status in ('confirmed','processing','shipped') and current_order.payment_method is distinct from 'cod' and current_order.payment_status <> 'paid' then
    raise exception 'Confirm online payment before processing this order.' using errcode = '22023';
  end if;
  if p_status = 'shipped' and current_order.courier_consignment_id is null then
    raise exception 'Create a Steadfast shipment before marking this order shipped.' using errcode = '22023';
  end if;
  if p_status = 'delivered' and current_order.courier_status not in ('delivered','partial_delivered') then
    raise exception 'Sync Steadfast delivery confirmation before marking this order delivered.' using errcode = '22023';
  end if;
  perform set_config('app.workflow_actor_id',coalesce(p_actor_user_id::text,''),true);
  perform set_config('app.workflow_actor_email',p_actor_email,true);
  perform set_config('app.workflow_note',coalesce(p_note,''),true);
  update public.orders set status = p_status::public.order_status,
    payment_status = case when p_status='delivered' and payment_method='cod' then 'paid'::public.payment_status else payment_status end,
    admin_note = coalesce(p_note, admin_note), updated_at = now()
    where id = p_order_id returning * into current_order;
  return current_order;
end;
$$;

create or replace function public.admin_record_order_refund(
  p_order_id uuid, p_reference text, p_actor_user_id uuid, p_actor_email text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if current_order.payment_status <> 'paid' then raise exception 'Only a paid order can be refunded.' using errcode = '22023'; end if;
  if current_order.status not in ('delivered','cancelled') then raise exception 'Refunds can be recorded after delivery or cancellation.' using errcode = '22023'; end if;
  if nullif(trim(p_reference),'') is null then raise exception 'Enter the completed refund transaction reference.' using errcode = '22023'; end if;
  perform set_config('app.workflow_actor_id',coalesce(p_actor_user_id::text,''),true);
  perform set_config('app.workflow_actor_email',p_actor_email,true);
  perform set_config('app.workflow_note',coalesce(nullif(p_note,''),'Refund recorded'),true);
  update public.orders set status='refunded', payment_status='refunded', payment_refund_reference=trim(p_reference), admin_note=coalesce(p_note,admin_note), updated_at=now()
    where id=p_order_id returning * into current_order;
  update public.payment_transactions set status='refunded', updated_at=now() where order_id=p_order_id and status='paid';
  return current_order;
end;
$$;

create or replace function public.admin_change_custom_request_status(
  p_request_id uuid, p_status text, p_actor_user_id uuid, p_actor_email text,
  p_note text default null, p_quoted_price_bdt numeric default null
) returns public.custom_requests language plpgsql security definer set search_path = '' as $$
declare current_request public.custom_requests%rowtype; allowed boolean := false;
begin
  select * into current_request from public.custom_requests where id=p_request_id for update;
  if not found then raise exception 'Custom request not found.' using errcode = 'P0002'; end if;
  if p_status = current_request.status::text then return current_request; end if;
  allowed := case current_request.status::text
    when 'new' then p_status in ('reviewing','declined','cancelled')
    when 'pending' then p_status in ('reviewing','confirmed','declined','cancelled')
    when 'reviewing' then p_status in ('quoted','declined','cancelled')
    when 'quoted' then p_status in ('confirmed','declined','cancelled')
    when 'confirmed' then p_status in ('processing','cancelled')
    when 'processing' then p_status in ('shipped','completed','cancelled')
    when 'shipped' then p_status = 'delivered'
    when 'delivered' then p_status = 'completed'
    else false end;
  if not allowed then raise exception 'That custom request status transition is not allowed.' using errcode = '22023'; end if;
  if p_status='quoted' and (p_quoted_price_bdt is null or p_quoted_price_bdt < 0) then raise exception 'Enter a valid quote amount before sending a quote.' using errcode = '22023'; end if;
  perform set_config('app.workflow_actor_id',coalesce(p_actor_user_id::text,''),true);
  perform set_config('app.workflow_actor_email',p_actor_email,true);
  perform set_config('app.workflow_note',coalesce(p_note,''),true);
  update public.custom_requests set status=p_status::public.custom_request_status,
    admin_note=coalesce(p_note,admin_note), quoted_price_bdt=coalesce(p_quoted_price_bdt,quoted_price_bdt), updated_at=now()
    where id=p_request_id returning * into current_request;
  return current_request;
end;
$$;

revoke all on function public.admin_change_order_status(uuid,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_record_order_refund(uuid,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_change_custom_request_status(uuid,text,uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.admin_change_order_status(uuid,text,uuid,text,text) to service_role;
grant execute on function public.admin_record_order_refund(uuid,text,uuid,text,text) to service_role;
grant execute on function public.admin_change_custom_request_status(uuid,text,uuid,text,text,numeric) to service_role;
