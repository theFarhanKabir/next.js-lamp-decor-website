-- Remove the original demo storefront products so the catalogue starts empty
-- for products created through the admin panel. Match only their original slugs
-- and SKUs; retain any rows that have order or review history.
with demo_products(slug, sku) as (
  values
    ('marlow-table-lamp', 'CL-MARLOW'),
    ('solis-pendant', 'CL-SOLIS'),
    ('oslo-side-table', 'CL-OSLO'),
    ('cleo-wall-sconce', 'CL-CLEO'),
    ('milo-console-table', 'CL-MILO'),
    ('iris-dining-table', 'CL-IRIS'),
    ('nora-table-lamp', 'CL-NORA'),
    ('arc-floor-lamp', 'CL-ARC'),
    ('solene-wall-mirror', 'CL-SOLENE'),
    ('isla-linen-lamp-shade', 'CL-ISLA'),
    ('remy-marble-side-table', 'CL-REMY'),
    ('ellery-full-length-mirror', 'CL-ELLERY'),
    ('marin-pleated-shade', 'CL-MARIN'),
    ('luna-pendant', 'CL-LUNA'),
    ('mira-round-mirror', 'CL-MIRA'),
    ('cole-nesting-tables', 'CL-COLE'),
    ('noor-velvet-shade', 'CL-NOOR')
)
update public.products as product
set status = 'archived', published_at = null, updated_at = now()
from demo_products as demo
where product.slug = demo.slug
  and product.sku = demo.sku
  and (
    exists (select 1 from public.order_items where product_id = product.id)
    or exists (select 1 from public.reviews where product_id = product.id)
  );

with demo_products(slug, sku) as (
  values
    ('marlow-table-lamp', 'CL-MARLOW'),
    ('solis-pendant', 'CL-SOLIS'),
    ('oslo-side-table', 'CL-OSLO'),
    ('cleo-wall-sconce', 'CL-CLEO'),
    ('milo-console-table', 'CL-MILO'),
    ('iris-dining-table', 'CL-IRIS'),
    ('nora-table-lamp', 'CL-NORA'),
    ('arc-floor-lamp', 'CL-ARC'),
    ('solene-wall-mirror', 'CL-SOLENE'),
    ('isla-linen-lamp-shade', 'CL-ISLA'),
    ('remy-marble-side-table', 'CL-REMY'),
    ('ellery-full-length-mirror', 'CL-ELLERY'),
    ('marin-pleated-shade', 'CL-MARIN'),
    ('luna-pendant', 'CL-LUNA'),
    ('mira-round-mirror', 'CL-MIRA'),
    ('cole-nesting-tables', 'CL-COLE'),
    ('noor-velvet-shade', 'CL-NOOR')
)
delete from public.products as product
using demo_products as demo
where product.slug = demo.slug
  and product.sku = demo.sku
  and not exists (select 1 from public.order_items where product_id = product.id)
  and not exists (select 1 from public.reviews where product_id = product.id);
