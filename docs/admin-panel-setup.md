# Admin panel and Supabase setup

## Admin panel preview

`src/components/admin/AdminPanel.tsx` is rendered at `/admin`. Product create, edit, publish, draft, and archive actions use `/api/admin/products` and require an authenticated Supabase user with the trusted `app_metadata.role = "admin"` claim. Admins can set product copy, SKU, department and subcategory, current and original BDT prices, inventory, dimensions, made-to-order lead time, size/fabric/leg price adjustments, filter materials, finish swatches, special-edition status, and multiple product images. Uploaded files use the protected admin write policies on the public `store-media` bucket.

The **Homepage content** section edits hero slides, top category cards, and hot deal cards. It supports visibility toggles, image URLs or uploads, accessible image alt text, slide copy and collection links, category names and collection slugs, and hot deal product links and displayed campaign prices. The existing remote image URLs and copy are the defaults and remain unchanged until saved overrides are supplied. Public reads use `/api/homepage-content`; admin writes use `/api/admin/homepage-content` and the existing `store_settings` table.

`/api/catalog` returns active database products alongside the local starter catalogue. New products are available on the storefront by their product slug after publication. The existing admin order, customer, and analytics figures remain preview data; review moderation and custom requests are connected separately.

The add-subcategory and create-coupon dialogs remain visual previews. The Custom Requests inbox and customer submission form use `/api/custom-requests`. Customer product reviews use `/api/reviews`; customers must sign in, and submitted reviews remain hidden until an administrator approves them. These live features need the migrations and Supabase keys below.

## Database migration

Apply the migrations in timestamp order. `20261008000000_store_admin_schema.sql` creates the store tables, fixed top-level departments, starter subcategories, customer profiles, product image records, order records, custom requests and private reference-photo storage, coupons, reviews, rewards, store settings, and the `store-media` Storage bucket. `20261009000000_product_customer_reviews.sql` connects reviews to storefront product slugs and limits each signed-in customer to one review per product. `20261010000000_seed_storefront_products.sql` brings the current 17 starter products and their images into the admin-managed catalogue without overwriting existing records. `20261011000000_homepage_content.sql` grants public read access to homepage settings while retaining admin-only writes.

Apply it to the intended Supabase project using the Supabase SQL Editor, or with the Supabase CLI after linking the project:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Review the target project before applying migrations. This workspace has no Supabase project credentials, so the migration has been prepared locally and has not been applied to a hosted database.

## Granting admin access

Admin policies check the trusted JWT claim `app_metadata.role = "admin"`. Set that claim for a user with the Supabase Admin API from a trusted server or one-time server-side script. Do not set it through browser code or user-editable `user_metadata`.

```ts
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { role: "admin" },
});
```

The Admin API requires a service-role key. Keep that key on a trusted server and out of `NEXT_PUBLIC_` variables. For custom request submissions, add it to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`. Once the admin claim is added, have the user refresh their session to receive a new access token.

For a local one-time setup, add the server-only key to the root `.env.local`, open **Authentication → Users** in Supabase, copy the intended user's UUID, then run this from the project root:

```powershell
node --env-file=.env.local scripts/grant-admin.mjs YOUR_USER_UUID
```

The script reads the key from `.env.local`, updates only that user's trusted `app_metadata.role` claim, and never prints the key. Remove the server-only key from `.env.local` afterward if no enabled server feature needs it. Sign out and sign back in to refresh the user's session.

## Local environment

Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` only when using the trusted custom-request server flow. Apply all migrations and add the admin claim before using product management, homepage content, or image uploads. This workspace does not include project credentials, so migrations cannot be applied or live database behavior confirmed from this checkout. Keep order creation behind a trusted checkout endpoint; the migration does not allow customers to write order totals or payment state directly from the browser.

For the complete feature inventory and current implementation status, see [store-admin-and-supabase.md](store-admin-and-supabase.md).
