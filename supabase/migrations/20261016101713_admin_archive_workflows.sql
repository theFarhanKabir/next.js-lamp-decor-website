alter table public.orders
  add column if not exists archived_at timestamptz;

alter table public.custom_requests
  add column if not exists archived_at timestamptz;

create index if not exists orders_archived_placed_at_idx
  on public.orders (placed_at desc)
  where archived_at is not null;

create index if not exists custom_requests_archived_created_at_idx
  on public.custom_requests (created_at desc)
  where archived_at is not null;

create table if not exists public.admin_media_archive (
  bucket_id text not null,
  object_path text not null,
  archived_at timestamptz not null default now(),
  archived_by_user_id uuid references auth.users(id) on delete set null,
  primary key (bucket_id, object_path),
  check (bucket_id <> ''),
  check (object_path <> '')
);

alter table public.admin_media_archive enable row level security;
revoke all on public.admin_media_archive from anon, authenticated;
grant all on public.admin_media_archive to service_role;

create or replace function public.admin_delete_archived_order(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_archived_at timestamptz;
begin
  select archived_at into current_archived_at
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if current_archived_at is null then
    raise exception 'Archive the order before permanently deleting it.' using errcode = '22023';
  end if;

  delete from public.payment_transactions where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.admin_delete_archived_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_archived_order(uuid) to service_role;
