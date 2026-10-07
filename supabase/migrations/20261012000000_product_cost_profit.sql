-- Product cost and order-time cost snapshots support gross profit reporting.
-- All monetary values are stored in BDT, matching the existing order schema.

alter table public.products
  add column if not exists cost_price_bdt numeric(12,2);

do $$ begin
  alter table public.products
    add constraint products_cost_price_nonnegative check (cost_price_bdt is null or cost_price_bdt >= 0);
exception when duplicate_object then null; end $$;

alter table public.order_items
  add column if not exists unit_cost_bdt numeric(12,2);

create or replace function public.snapshot_order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_cost_bdt is null and new.product_id is not null then
    select product.cost_price_bdt into new.unit_cost_bdt
    from public.products as product
    where product.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_order_item_cost_before_insert on public.order_items;
create trigger snapshot_order_item_cost_before_insert
before insert on public.order_items
for each row execute function public.snapshot_order_item_cost();

do $$ begin
  alter table public.order_items
    add constraint order_items_unit_cost_nonnegative check (unit_cost_bdt is null or unit_cost_bdt >= 0);
exception when duplicate_object then null; end $$;

create index if not exists orders_placed_status_profit_idx
  on public.orders(placed_at, status);

comment on column public.products.cost_price_bdt is
  'Admin-maintained current unit acquisition or production cost in BDT.';
comment on column public.order_items.unit_cost_bdt is
  'Unit cost copied at sale time so later product cost edits do not rewrite historical gross profit.';
