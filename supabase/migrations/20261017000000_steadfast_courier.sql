-- Steadfast shipment references and latest courier state.
alter table public.orders
  add column if not exists courier_invoice text unique,
  add column if not exists courier_consignment_id bigint,
  add column if not exists courier_tracking_code text,
  add column if not exists courier_status text not null default 'not_submitted',
  add column if not exists courier_return_request_id bigint,
  add column if not exists courier_return_status text,
  add column if not exists courier_message text,
  add column if not exists courier_updated_at timestamptz,
  add column if not exists courier_submitted_at timestamptz;

create index if not exists orders_courier_tracking_idx
  on public.orders(courier_tracking_code) where courier_tracking_code is not null;
