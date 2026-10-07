-- Homepage hero, category-card, and hot-deal content is stored as JSON in the
-- existing settings table. The application uses its current embedded image URLs
-- as defaults until an administrator saves overrides.
drop policy if exists "public store settings read" on public.store_settings;
create policy "public store settings read" on public.store_settings for select to anon, authenticated
using (key in ('store_profile', 'rewards', 'homepage_content') or (select public.is_store_admin()));
