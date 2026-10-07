-- Cloud Lamps & Mirrors store administration schema.
-- Apply this migration in the Supabase SQL editor or with `supabase db push`.
-- Admin access is granted only from trusted app_metadata (`role = admin`).

create extension if not exists pgcrypto;

do $$ begin
  create type public.product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.review_status as enum ('pending', 'published', 'hidden');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.custom_request_status as enum ('new', 'reviewing', 'quoted', 'completed', 'declined');
exception when duplicate_object then null; end $$;

create or replace function public.is_store_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.handle_new_customer();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_fixed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, parent_id),
  check (parent_id is null or parent_id <> id),
  check (
    (parent_id is not null and not is_fixed)
    or (parent_id is null and is_fixed and slug in ('lamps', 'mirrors', 'tables', 'shades'))
  )
);
create index if not exists categories_parent_sort_idx on public.categories(parent_id, sort_order);

-- The four storefront departments are fixed. Their child categories remain editable.
insert into public.categories (name, slug, sort_order, is_fixed)
values ('Lamps', 'lamps', 1, true), ('Mirrors', 'mirrors', 2, true),
       ('Tables', 'tables', 3, true), ('Shades', 'shades', 4, true)
on conflict (slug) do update set is_fixed = true, parent_id = null;

insert into public.categories (parent_id, name, slug, sort_order, is_fixed)
select parent.id, child.name, child.slug, child.sort_order, false
from (values
  ('lamps', 'Table Lamps', 'table-lamps', 1),
  ('lamps', 'Floor Lamps', 'floor-lamps', 2),
  ('lamps', 'Pendant Lights', 'pendant-lights', 3),
  ('lamps', 'Wall Lights', 'wall-lights', 4),
  ('mirrors', 'Wall Mirrors', 'wall-mirrors', 1),
  ('mirrors', 'Full-Length Mirrors', 'full-length-mirrors', 2),
  ('mirrors', 'Vanity Mirrors', 'vanity-mirrors', 3),
  ('tables', 'Side Tables', 'side-tables', 1),
  ('tables', 'Coffee Tables', 'coffee-tables', 2),
  ('tables', 'Console Tables', 'console-tables', 3),
  ('tables', 'Dining Tables', 'dining-tables', 4),
  ('shades', 'Lamp Shades', 'lamp-shades', 1),
  ('shades', 'Pendant Shades', 'pendant-shades', 2)
) as child(parent_slug, name, slug, sort_order)
join public.categories parent on parent.slug = child.parent_slug
on conflict (slug) do update set parent_id = excluded.parent_id, is_fixed = false;

create or replace function public.protect_store_departments()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_fixed and (tg_op = 'DELETE' or new.name is distinct from old.name or new.slug is distinct from old.slug or new.parent_id is not null or new.is_fixed is distinct from old.is_fixed or new.is_active is distinct from old.is_active) then
    raise exception 'The four top-level store departments are fixed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists protect_store_departments on public.categories;
create trigger protect_store_departments before update or delete on public.categories
for each row when (old.is_fixed) execute function public.protect_store_departments();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid,
  name text not null,
  slug text not null unique,
  sku text unique,
  short_description text,
  description text not null default '',
  price_bdt numeric(12,2) not null check (price_bdt >= 0),
  compare_at_price_bdt numeric(12,2) check (compare_at_price_bdt is null or compare_at_price_bdt >= price_bdt),
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  track_inventory boolean not null default true,
  status public.product_status not null default 'draft',
  made_to_order boolean not null default false,
  lead_time text,
  attributes jsonb not null default '{}'::jsonb,
  swatches jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subcategory_id, category_id) references public.categories(id, parent_id) on delete restrict
);
create index if not exists products_category_status_idx on public.products(category_id, status, sort_order);
create index if not exists products_subcategory_idx on public.products(subcategory_id);
create index if not exists products_search_idx on public.products using gin (to_tsvector('simple', name || ' ' || coalesce(sku, '') || ' ' || description));

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text,
  public_url text not null,
  alt_text text,
  image_role text not null default 'product' check (image_role in ('product', 'lifestyle', 'thumbnail')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_sort_idx on public.product_images(product_id, sort_order);

create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated by default as identity unique,
  customer_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  city_area text not null,
  delivery_address text not null,
  description text not null,
  status public.custom_request_status not null default 'new',
  admin_note text,
  quoted_price_bdt numeric(12,2) check (quoted_price_bdt is null or quoted_price_bdt >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_requests_status_date_idx on public.custom_requests(status, created_at desc);
create index if not exists custom_requests_customer_date_idx on public.custom_requests(customer_id, created_at desc);

create table if not exists public.custom_request_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists custom_request_images_request_idx on public.custom_request_images(request_id, sort_order);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated by default as identity unique,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  payment_method text,
  shipping_address jsonb not null default '{}'::jsonb,
  subtotal_bdt numeric(12,2) not null check (subtotal_bdt >= 0),
  delivery_fee_bdt numeric(12,2) not null default 0 check (delivery_fee_bdt >= 0),
  discount_bdt numeric(12,2) not null default 0 check (discount_bdt >= 0),
  total_bdt numeric(12,2) not null check (total_bdt >= 0),
  coupon_id uuid,
  customer_note text,
  admin_note text,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_date_idx on public.orders(customer_id, placed_at desc);
create index if not exists orders_status_date_idx on public.orders(status, placed_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_sku text,
  selected_options jsonb not null default '{}'::jsonb,
  unit_price_bdt numeric(12,2) not null check (unit_price_bdt >= 0),
  quantity integer not null check (quantity > 0),
  line_total_bdt numeric(12,2) not null check (line_total_bdt >= 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_bdt numeric(12,2) not null default 0,
  usage_limit integer,
  usage_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (usage_limit is null or usage_limit >= usage_count)
);
alter table public.orders drop constraint if exists orders_coupon_id_fkey;
alter table public.orders add constraint orders_coupon_id_fkey foreign key (coupon_id) references public.coupons(id) on delete set null;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text not null,
  status public.review_status not null default 'pending',
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_product_status_idx on public.reviews(product_id, status, created_at desc);

create table if not exists public.reward_accounts (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  points_delta integer not null check (points_delta <> 0),
  reason text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reward_ledger_customer_date_idx on public.reward_ledger(customer_id, created_at desc);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(key, value) values
  ('store_profile', '{"name":"Cloud Lamps & Mirrors","currency":"BDT","country":"Bangladesh"}'::jsonb),
  ('rewards', '{"enabled":true,"points_per_100_bdt":1,"redemption_points":100,"redemption_value_bdt":100}'::jsonb)
on conflict (key) do nothing;

-- Keep timestamps current on admin edits.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','orders','reviews','reward_accounts','store_settings','custom_requests'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- No public or customer writes are granted here. Customer reads are limited to their own
-- profile, orders, order items, reviews, and reward records; store administration uses
-- trusted app_metadata.role = 'admin' claims.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.reviews enable row level security;
alter table public.custom_requests enable row level security;
alter table public.custom_request_images enable row level security;
alter table public.reward_accounts enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_store_admin()));
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select public.is_store_admin()))
with check (id = (select auth.uid()) or (select public.is_store_admin()));

drop policy if exists "active catalog read" on public.categories;
create policy "active catalog read" on public.categories for select to anon, authenticated
using (is_active or (select public.is_store_admin()));
drop policy if exists "admin manage categories" on public.categories;
create policy "admin manage categories" on public.categories for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "active products read" on public.products;
create policy "active products read" on public.products for select to anon, authenticated
using (status = 'active' or (select public.is_store_admin()));
drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "product images read" on public.product_images;
create policy "product images read" on public.product_images for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or (select public.is_store_admin()))));
drop policy if exists "admin manage product images" on public.product_images;
create policy "admin manage product images" on public.product_images for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "customer read own orders or admin" on public.orders;
create policy "customer read own orders or admin" on public.orders for select to authenticated
using (customer_id = (select auth.uid()) or lower(customer_email) = lower((select auth.jwt() ->> 'email')) or (select public.is_store_admin()));
drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders" on public.orders for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "read own order items or admin" on public.order_items;
create policy "read own order items or admin" on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or lower(o.customer_email) = lower((select auth.jwt() ->> 'email')) or (select public.is_store_admin()))));
drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items" on public.order_items for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "active coupons read" on public.coupons;
create policy "active coupons read" on public.coupons for select to anon, authenticated
using (is_active or (select public.is_store_admin()));
drop policy if exists "admin manage coupons" on public.coupons;
create policy "admin manage coupons" on public.coupons for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "published reviews read" on public.reviews;
create policy "published reviews read" on public.reviews for select to anon, authenticated
using (status = 'published' or customer_id = (select auth.uid()) or (select public.is_store_admin()));
drop policy if exists "signed in customer create review" on public.reviews;
create policy "signed in customer create review" on public.reviews for insert to authenticated
with check (customer_id = (select auth.uid()));
drop policy if exists "admin manage reviews" on public.reviews;
create policy "admin manage reviews" on public.reviews for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "customer read own custom requests or admin" on public.custom_requests;
create policy "customer read own custom requests or admin" on public.custom_requests for select to authenticated
using (customer_id = (select auth.uid()) or (select public.is_store_admin()));
drop policy if exists "admin manage custom requests" on public.custom_requests;
create policy "admin manage custom requests" on public.custom_requests for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
drop policy if exists "customer read own request images or admin" on public.custom_request_images;
create policy "customer read own request images or admin" on public.custom_request_images for select to authenticated
using (exists (select 1 from public.custom_requests r where r.id = request_id and (r.customer_id = (select auth.uid()) or (select public.is_store_admin()))));
drop policy if exists "admin manage custom request images" on public.custom_request_images;
create policy "admin manage custom request images" on public.custom_request_images for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "read own rewards or admin" on public.reward_accounts;
create policy "read own rewards or admin" on public.reward_accounts for select to authenticated
using (customer_id = (select auth.uid()) or (select public.is_store_admin()));
drop policy if exists "admin manage rewards" on public.reward_accounts;
create policy "admin manage rewards" on public.reward_accounts for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
drop policy if exists "read own reward history or admin" on public.reward_ledger;
create policy "read own reward history or admin" on public.reward_ledger for select to authenticated
using (customer_id = (select auth.uid()) or (select public.is_store_admin()));
drop policy if exists "admin manage reward history" on public.reward_ledger;
create policy "admin manage reward history" on public.reward_ledger for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

drop policy if exists "public store settings read" on public.store_settings;
create policy "public store settings read" on public.store_settings for select to anon, authenticated
using (key = 'store_profile' or key = 'rewards' or (select public.is_store_admin()));
drop policy if exists "admin manage store settings" on public.store_settings;
create policy "admin manage store settings" on public.store_settings for all to authenticated
using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

-- Optional product media bucket. Actual file access is restricted to trusted admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('custom-request-references', 'custom-request-references', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "store media public read" on storage.objects;
create policy "store media public read" on storage.objects for select to anon, authenticated
using (bucket_id = 'store-media');
drop policy if exists "store media admin insert" on storage.objects;
create policy "store media admin insert" on storage.objects for insert to authenticated
with check (bucket_id = 'store-media' and (select public.is_store_admin()));
drop policy if exists "store media admin update" on storage.objects;
create policy "store media admin update" on storage.objects for update to authenticated
using (bucket_id = 'store-media' and (select public.is_store_admin()))
with check (bucket_id = 'store-media' and (select public.is_store_admin()));
drop policy if exists "store media admin delete" on storage.objects;
create policy "store media admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'store-media' and (select public.is_store_admin()));

drop policy if exists "custom request image admin read" on storage.objects;
create policy "custom request image admin read" on storage.objects for select to authenticated
using (bucket_id = 'custom-request-references' and (select public.is_store_admin()));
drop policy if exists "custom request image admin insert" on storage.objects;
create policy "custom request image admin insert" on storage.objects for insert to authenticated
with check (bucket_id = 'custom-request-references' and (select public.is_store_admin()));
drop policy if exists "custom request image admin update" on storage.objects;
create policy "custom request image admin update" on storage.objects for update to authenticated
using (bucket_id = 'custom-request-references' and (select public.is_store_admin()))
with check (bucket_id = 'custom-request-references' and (select public.is_store_admin()));
drop policy if exists "custom request image admin delete" on storage.objects;
create policy "custom request image admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'custom-request-references' and (select public.is_store_admin()));
