-- Reviews can refer to catalogue slugs while the storefront catalogue is still
-- maintained locally. product_id is filled whenever a matching DB product exists.
alter table public.reviews alter column product_id drop not null;
alter table public.reviews add column if not exists product_slug text;

update public.reviews r
set product_slug = p.slug
from public.products p
where r.product_id = p.id and r.product_slug is null;

create index if not exists reviews_product_slug_status_idx
  on public.reviews(product_slug, status, created_at desc);
create unique index if not exists reviews_one_per_customer_product_idx
  on public.reviews(customer_id, product_slug)
  where customer_id is not null and product_slug is not null;

drop policy if exists "signed in customer create review" on public.reviews;
create policy "signed in customer create pending review" on public.reviews
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'pending'
    and admin_reply is null
  );
