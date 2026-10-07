# Store admin and Supabase feature guide

This project uses Next.js for the storefront and server routes, Supabase Auth for customer and admin sessions, Postgres for structured store data, and Supabase Storage for product and homepage imagery. This is the current application boundary; a separate Node.js backend can replace or extend the route handlers later.

## Store admin (`/admin`)

### Connected features

- **Products:** create and edit products; save drafts; publish and archive products; assign one of the fixed departments and a subcategory; manage SKU, descriptions, selling and original BDT prices, unit cost, inventory, made-to-order status and lead time, dimensions, size/fabric/leg price adjustments, searchable materials, and image galleries. Each colour finish stores its label, swatch colour, and optional finish-specific image. Selecting a finish on `/products/{slug}` changes the gallery to that image. Published database products are returned by `/api/catalog`.
- **Homepage content:** edit or hide individual hero slides, top category cards, and hot deal cards; replace images by HTTPS URL or upload; edit image alt text; update hero copy and collection target; edit category name and collection slug; select a hot deal product and edit its card label and displayed prices. The existing images and copy are the defaults. The storefront uses them until an administrator saves an override.
- **Media storage:** product and homepage uploads go to the public `store-media` bucket. Public read access is intentional for storefront images. Storage upload, update, and delete policies require the trusted admin claim.
- **Customer reviews:** the admin can load reviews and set them to pending, published, or hidden. Published reviews are visible to customers; customers must be signed in to submit a review.
- **Custom requests:** the customer request form submits through `/api/custom-requests`; the admin inbox reads requests and protected reference images and supports review/status handling.

### Preview or not yet connected

- Overview sales figures, order samples, and customer samples are demonstration data. The **Sales & profit** analytics page reads its monthly and yearly report from real Supabase orders.
- Orders are represented in the schema, but checkout does not yet create trusted database orders or process payments. Sales reports remain empty until a trusted checkout/backend workflow writes order and line-item records.
- Categories show fixed departments and seeded subcategories. The add-subcategory dialog is still a preview.
- Coupons, rewards, most store settings, and the media library controls are previews rather than complete CRUD workflows.

The admin interface can be opened without a claim, but all write APIs and Supabase row/storage policies enforce administrator access. To administer data, sign in with a user whose trusted `app_metadata.role` is `admin`.

## Supabase data model

The migrations create these main tables and relationships:

- `categories`: four fixed top-level departments (`lamps`, `mirrors`, `tables`, `shades`) and editable child categories.
- `products`: unique slug and SKU, department/subcategory, copy, selling/original/unit-cost BDT values, stock tracking, draft/active/archived state, made-to-order details, JSON attributes and finish swatches. Each swatch can store `label`, `color`, and `imageUrl`. Flexible JSON attributes hold sizes, price adjustments, dimensions, and filter materials.
- `product_images`: ordered product/lifestyle image URLs and optional Storage paths.
- `profiles`: customer record linked to `auth.users`; a database trigger creates a profile on signup.
- `orders` and `order_items`: order/customer/shipping/payment records and line-item option snapshots. Each line item has a `unit_cost_bdt` cost snapshot, copied automatically from the product when a new line is inserted. RLS does not allow customer-side writes to totals or payment status.
- `reviews`: product/customer/rating/content with pending, published, and hidden moderation status.
- `custom_requests` and `custom_request_images`: customer design briefs and private reference-photo metadata.
- `coupons`: discount rules and redemption limits.
- `reward_accounts` and `reward_ledger`: point balances and an auditable points history.
- `store_settings`: JSON settings for store profile, rewards, and the `homepage_content` key used for hero/category/deal content.

Storage uses `store-media` for public storefront images and `custom-request-references` for private customer reference files. Admin-only writes are enforced in Postgres Storage policies.

## Sales and profit reporting

The admin **Sales & profit** page reads orders in `confirmed`, `processing`, `shipped`, or `delivered` status; cancelled, refunded, and pending orders are excluded. It groups product line totals by the order placement month and year. Delivery fees are not included in product sales.

- Product sales are the sum of `order_items.line_total_bdt`.
- Product cost is `order_items.unit_cost_bdt × quantity`, using the saved order-time snapshot so changing a product's cost later does not rewrite prior periods.
- Gross profit is product sales minus saved product cost. It excludes delivery, payment fees, tax, marketing, overhead, and other operating expenses, so it is not net profit.
- If any line has no saved cost, the affected profit total is marked incomplete instead of being reported as a complete figure. Historical lines created before the cost migration need their original costs entered before those periods can be complete.

The migration adds `products.cost_price_bdt`, `order_items.unit_cost_bdt`, and the insert trigger that snapshots cost. It does not backfill old order costs because the true historical unit cost cannot be inferred safely from today's product cost.

## Access and security

- Public and signed-in customers can read active products, active categories, public product images, homepage settings, and published reviews.
- Customers can read and update only their own profile and read their own order/reward records, subject to the table policies.
- Admin database and storage policies check the signed JWT's trusted `app_metadata.role = "admin"` claim. Do not grant admin through user-editable `user_metadata` or browser code.
- Server routes verify the current Supabase user and admin claim before product or homepage writes.
- Keep the service-role key server-side. It bypasses RLS and must never use a `NEXT_PUBLIC_` name.

## Setup and activation

1. Copy `.env.example` to `.env.local`; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set `SUPABASE_SERVICE_ROLE_KEY` only for trusted server workflows that need it.
  2. Apply migrations in order: `20261008000000_store_admin_schema.sql`, `20261009000000_product_customer_reviews.sql`, `20261010000000_seed_storefront_products.sql`, `20261011000000_homepage_content.sql`, `20261012000000_product_cost_profit.sql`, then `20261013000000_product_image_variants.sql` and `20261014000000_checkout_order_rpc.sql` if using the standalone Node API's optimized responsive images and transactional checkout.
3. Set `app_metadata.role = "admin"` for the intended account using the Supabase Admin API from a trusted server or one-time script, then refresh that user's session.
4. Restart `npm run dev`, open `/admin`, and use **Products** and **Homepage content**. Product settings and homepage overrides persist in Postgres; uploaded images are stored in Supabase Storage.

If no Supabase project environment is configured, the site keeps its local product and homepage defaults. Homepage edits cannot be persisted and product admin APIs report that Supabase is not configured. The migrations in this repository are prepared but must be applied to the intended Supabase project.
