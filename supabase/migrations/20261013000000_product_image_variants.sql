-- Persist responsive image URLs produced by the standalone Node API.
-- The original image remains available through public_url; variants preserve
-- orientation and aspect ratio and are stored as optimized WebP files.

alter table public.product_images
  add column if not exists image_variants jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.product_images
    add constraint product_images_variants_array check (jsonb_typeof(image_variants) = 'array');
exception when duplicate_object then null; end $$;

comment on column public.product_images.image_variants is
  'Responsive optimized image metadata, each entry containing width, height, public URL, Storage path, and byte size.';
