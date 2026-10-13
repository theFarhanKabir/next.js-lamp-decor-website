# Store admin and Supabase feature guide

This project uses Next.js for the storefront, a standalone Node.js API for `/api/*` requests when `NEXT_PUBLIC_BACKEND_URL` is set, Supabase Auth for customer and admin sessions, Postgres for store data, and Supabase Storage for product and homepage imagery. The Next.js route handlers remain a fallback for the routes they implement when the backend URL is blank.

## Store admin (`/admin`)

### Connected features

- **Products:** create and edit products; save drafts; publish and archive products; permanently delete products without order or review history; assign one of the fixed departments and a subcategory; manage SKU, descriptions, selling and original BDT prices, unit cost, inventory, made-to-order status and lead time, structured dimensions, size price adjustments, searchable materials and Materials-tab details, New Arrivals/Hot Deals collection tags, colour swatches, and image galleries. Products with history must be archived to preserve records. Each colour finish stores its label, swatch colour, and optional finish-specific image. Selecting a finish on `/products/{slug}` changes the gallery to that image. With Supabase connected successfully, active database products are authoritative; archived products do not reappear from local fallback data.
- **Homepage content:** add, edit, hide, and remove hero slides, top category cards, New Arrivals products, and Hot Deals cards. New Arrivals is rendered on the landing page and features active products from the catalogue; upload product imagery in Products and select those products here. Hot Deals cards link to catalogue products, upload or replace card imagery, and display the current price from the linked product so it matches cart and checkout pricing. Admins can restore the starter selections. Limits are 10 hero slides, 12 category cards, 30 New Arrivals products, and 30 Hot Deals cards. Homepage settings are stored in `store_settings`; the storefront refreshes after successful admin saves.
- **Categories:** load fixed departments and their database subcategories; add, rename, or remove subcategories. Renames preserve the saved slug while the storefront updates displayed names, navigation links, and product filters. Removal is blocked while a product is assigned. The fixed top-level departments cannot be renamed or removed; once Supabase is authoritative, a department with no subcategories stays empty rather than showing demo links.
- **Media storage:** product and homepage uploads go to the public `store-media` bucket. Public read access is intentional for storefront images. Storage upload, update, and delete policies require the trusted admin claim.
- **Customer reviews:** the admin can load reviews and set them to pending, published, or hidden. Published reviews are visible to customers; customers must be signed in to submit a review.
- **Custom requests:** the customer request form submits through `/api/custom-requests`; the admin inbox reads requests and protected reference images and supports review/status handling.
- **Orders and checkout:** checkout re-reads prices and validates options and inventory on the server, then calls a transactional Postgres RPC to write orders and lines and reserve stock. Coupons and signed-in reward redemption are checked and recorded atomically; delivered eligible orders earn points, and cancellation/refund transitions restore stock and reverse coupon/reward entries. Visa, Mastercard, and bKash use SSLCOMMERZ Hosted Checkout when merchant credentials and public callbacks are configured. Gateway callbacks and IPN are independently validated for transaction ID, amount, BDT currency, status, and risk before payment state changes.
- **Customer persistence:** guest carts and wishlists stay in browser storage. Signed-in carts and wishlists also sync to the customer's own row in Postgres and merge when a guest signs in.
- **Overview and customers:** overview sales/order/customer totals and the customer directory read Supabase orders, profiles, and Auth users.
- **Coupons and rewards:** admins can manage coupon records and programme settings and see issued, redeemed, spendable, and reversed-point totals. Checkout previews discounts, then validates redemption under database locks to prevent overspending.
- **Store profile:** admins can read and save the store profile in `store_settings`.

### Preview or not yet connected

- Online card and bKash charging requires an SSLCOMMERZ merchant account, server-only credentials, and a public HTTPS backend callback/IPN URL. Until those are configured and a sandbox transaction is completed, the gateway cannot be exercised from this workspace.
- Signed-in admin workflows still require a live session for an account whose trusted `app_metadata.role` is `admin`; I cannot use your browser's active sign-in here. No production/test order was created during these changes.

The admin interface can be opened without a claim, but protected APIs and Supabase row/storage policies enforce administrator access. To administer data, sign in with a user whose trusted `app_metadata.role` is `admin`.

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
- Keep the Supabase secret key server-side. It bypasses RLS and must never use a `NEXT_PUBLIC_` name; the legacy service-role key is supported as a fallback.

## Setup and activation

1. Copy `.env.example` to `.env.local`; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set `SUPABASE_SECRET_KEY` only for trusted server workflows that need it; the legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported.
2. Apply migrations in order: `20261008000000_store_admin_schema.sql`, `20261009000000_product_customer_reviews.sql`, `20261010000000_seed_storefront_products.sql`, `20261011000000_homepage_content.sql`, `20261012000000_product_cost_profit.sql`, `20261013000000_product_image_variants.sql`, `20261014000000_checkout_order_rpc.sql`, `20261015000000_database_integrity_guards.sql`, and `20261016000000_customer_checkout_features.sql`.
3. Set `app_metadata.role = "admin"` for the intended account using the Supabase Admin API from a trusted server or one-time script, then refresh that user's session.
4. Restart `npm run dev`, open `/admin`, and use **Products** and **Homepage content**. Product settings and homepage overrides persist in Postgres; uploaded images are stored in Supabase Storage.

If no Supabase project environment is configured, the site keeps its local product and homepage defaults. The seed migration inserts 17 starter products and their sample images with `ON CONFLICT DO NOTHING`; it does not overwrite existing product rows. Migration `20261016000000_customer_checkout_features.sql` creates per-user storefront state and payment records, replaces the transactional order function for coupons/rewards, adds payment settlement functions and seeds homepage defaults only if no saved homepage row exists. Once Supabase returns successfully, active database rows become authoritative, so admin archives stay archived instead of resurfacing as local samples. The user-provided prior CLI output showed the remote was up to date before this migration was added; apply the new migration after reviewing its dry run. The latest prior read-only findings are recorded in [admin-panel-setup.md](admin-panel-setup.md).
