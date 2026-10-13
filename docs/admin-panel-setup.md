# Admin panel and Supabase setup

## Admin panel data connections

`src/components/admin/AdminPanel.tsx` is rendered at `/admin`. Product create, edit, publish, draft, archive, and guarded delete actions use `/api/admin/products` and require an authenticated Supabase user with the trusted `app_metadata.role = "admin"` claim. Products with order or review history must be archived instead of permanently deleted. Admins can set product copy, SKU, department and subcategory, current and original BDT prices, inventory, structured dimensions, made-to-order lead time, size price adjustments, filter materials, Materials-tab details, New Arrivals/Hot Deals collection tags, colour swatches, and multiple product images. Uploaded files use the protected admin write policies on the public `store-media` bucket.

The **Homepage content** section can add, edit, hide, and remove hero slides, top category cards, New Arrivals selections, and Hot Deals cards. New Arrivals features active catalogue products; add the product and its photos in Products, then select it here. Hot Deal cards link to catalogue products and use the linked product's current checkout price. Homepage content and uploaded card imagery are saved through `/api/admin/homepage-content` and Supabase Storage. The interface supports up to 10 hero slides, 12 category cards, 30 New Arrivals products, and 30 Hot Deals cards. Migration `20261016000000_customer_checkout_features.sql` saves the starter homepage only when no admin content already exists. Public reads use `/api/homepage-content`.

The **Categories** section loads the fixed departments and subcategories from `categories`. Admins can add, rename, and remove subcategories; renaming keeps the existing URL slug and updates the storefront labels, navigation, and product filters. Removal is blocked while products use a subcategory. The four top-level departments remain fixed. When Supabase catalogue data is available, an empty department stays empty instead of restoring hard-coded demo subcategories.

Set `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4000` to send storefront API calls through the standalone Node backend. The frontend sends the signed-in user's access token for protected operations; the backend independently verifies the user and trusted admin claim. With the backend URL blank, the Next.js Route Handlers remain the fallback for routes they implement. The backend reads the Supabase values from root `.env.local` and uses the same migrations.

With Supabase unconfigured or unavailable, `/api/catalog` uses the local starter catalogue. After a successful Supabase read, the active database catalogue is authoritative; this prevents archived products from reappearing from local fallback data. The seed migration inserts 17 starter products and images without overwriting existing product slugs. New products are available on the storefront by their product slug after publication. Product and category management, homepage content, checkout order creation, order fulfillment, customers, coupon administration, reward balances and settings, store profile, media library, sales reporting, review moderation, custom requests, and the Overview use database-backed APIs.

Coupons can be created, activated, deactivated, and deleted if unused; checkout previews and revalidates coupon eligibility atomically when the order is created. Signed-in customers can redeem points at checkout. Eligible paid or cash-on-delivery orders earn points after delivery, and order cancellations/refunds reverse points and coupon usage. Signed-in carts and wishlists sync to Supabase and merge with guest state when the customer signs in. Visa, Mastercard, and bKash use SSLCOMMERZ Hosted Checkout once merchant credentials and public callback URLs are configured; successful payments are only recorded after server-side transaction validation.

The Custom Requests inbox and customer submission form use `/api/custom-requests`. Customer product reviews use `/api/reviews`; customers must sign in, and submitted reviews remain hidden until an administrator approves them. These live features need the migrations and Supabase keys below.

## Database migration

Apply the migrations in timestamp order. `20261008000000_store_admin_schema.sql` creates the store tables, fixed top-level departments, starter subcategories, customer profiles, product image records, order records, custom requests and private reference-photo storage, coupons, reviews, rewards, store settings, and the `store-media` Storage bucket. `20261009000000_product_customer_reviews.sql` connects reviews to storefront product slugs and limits each signed-in customer to one review per product. `20261010000000_seed_storefront_products.sql` brings the current 17 starter products and their images into the admin-managed catalogue without overwriting existing records. `20261011000000_homepage_content.sql` grants public read access to homepage settings while retaining admin-only writes. The later migrations add cost snapshots, responsive image metadata, trusted transactional checkout, and database-level guards for category hierarchy and customer review writes.

Apply it to the intended Supabase project using the Supabase SQL Editor, or with the Supabase CLI after linking the project:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

The repository includes `supabase/config.toml`. The CLI was run with `npx supabase`, the project was linked, and the user's `supabase db push --dry-run` output reported that the remote database was up to date. Supabase hosts PostgreSQL for this project; a separate PostgreSQL installation is not needed. For a different project, link that project and review its dry-run output before applying migrations. The catalogue seed adds 17 starter products and their sample images on a fresh database; it skips product slugs that already exist.

## Granting admin access

Admin policies check the trusted JWT claim `app_metadata.role = "admin"`. Set that claim for a user with the Supabase Admin API from a trusted server or one-time server-side script. Do not set it through browser code or user-editable `user_metadata`.

```ts
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { role: "admin" },
});
```

The Admin API requires a trusted server-only key. Keep it out of `NEXT_PUBLIC_` variables. For custom request submissions, set `SUPABASE_SECRET_KEY` in `.env.local`; the legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted. Once the admin claim is added, have the user refresh their session to receive a new access token.

For a local one-time setup, add the server-only key to the root `.env.local`, open **Authentication → Users** in Supabase, copy the intended user's UUID, then run this from the project root:

```powershell
node --env-file=.env.local scripts/grant-admin.mjs YOUR_USER_UUID
```

The script reads the key from `.env.local`, updates only that user's trusted `app_metadata.role` claim, and never prints the key. Remove the server-only key from `.env.local` afterward if no enabled server feature needs it. Sign out and sign back in to refresh the user's session.

## Local environment

Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Add a valid `SUPABASE_SECRET_KEY` only for trusted server workflows. Apply all migrations and add the admin claim before using product management, homepage content, or image uploads. Keep order creation behind a trusted checkout endpoint; the database does not allow customers to write order totals or payment state directly from the browser.

### Read-only live check (2026-10-08)

The configured project is connected. The backend returned its health response with Supabase configured, and both the backend and Next.js catalogue APIs returned 17 active products and 13 subcategories with `source=supabase`. The backend returned successful read access to all expected tables: `profiles`, `categories`, `products`, `product_images`, `orders`, `order_items`, `coupons`, `reviews`, `custom_requests`, `custom_request_images`, `reward_accounts`, `reward_ledger`, and `store_settings`. Auth Admin read access succeeded. The expected `store-media` public bucket and `custom-request-references` private bucket were present. The migration dry run previously reported no pending migrations. No database rows or storage objects were changed during these checks.

Homepage content had no saved database override during the check, so the storefront used its configured default content. Admin APIs correctly rejected unauthenticated requests; complete admin-session testing requires signing in with a user whose trusted `app_metadata.role` is `admin`. Secrets were not printed during these checks.

For the complete feature inventory and current implementation status, see [store-admin-and-supabase.md](store-admin-and-supabase.md).
