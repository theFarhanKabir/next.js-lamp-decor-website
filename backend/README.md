# Cloud Lamps API

Standalone Node.js API for the existing storefront and admin data model. It is intentionally **not wired into the Next.js app** and has no Supabase credentials configured. The service can start and answer `GET /health`; database and upload routes return a clear `503` until Supabase is connected.

## Runtime

- Production target: Node.js **24.21.0 LTS**, pinned in `.nvmrc`.
- `npm install`
- Copy `.env.example` to `.env` only when you are ready to configure a project.
- `npm run dev` starts the API with file watching; `npm start` starts it normally.
- `npm run check` checks the JavaScript module syntax.
- Default local address: `http://127.0.0.1:4000`.

The latest Node.js Current line is newer than LTS. This backend targets the newest LTS release for a supported production runtime while remaining compatible with later Node 26 releases.

## No connection is made yet

All Supabase variables in `.env.example` are blank. The process does not make a Supabase request at startup. `/health` reports configuration presence without testing or exposing credentials. Database routes initialize the clients only when a request reaches them and all required values are present.

Before a later integration, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in this backend's private `.env`. The service-role key must stay server-side. Admin requests must send a verified Supabase access token as `Authorization: Bearer <token>`; the API checks the token with Supabase Auth and then requires the trusted `app_metadata.role = "admin"` claim. Customer write routes use a verified signed-in user token or the narrowly defined guest custom-request flow.

Set `ALLOWED_ORIGINS` to exact trusted site origins before browser integration. The starter value only allows local Next.js at `http://localhost:3000`. There is no wildcard credentialed CORS.

## Image handling

`POST /api/admin/media` accepts the raw file bytes (not multipart) with the original image content type and headers `Authorization`, `X-Image-Role: product|color|hero|category|deal`, and optional `X-Product-Slug` and `X-Image-Alt`. It checks actual image metadata, accepts JPG/PNG/WebP/AVIF up to the configured byte limit, applies EXIF orientation, rejects images above 40 megapixels, and converts without cropping or enlarging to transparent-capable WebP responsive sizes up to 1600 px. EXIF metadata is stripped. Product and colour objects are placed under `products/{slug}/{upload-id}/{width}.webp`; homepage media is placed under `homepage/{role}/{upload-id}/{width}.webp` in `store-media` with immutable caching.

The endpoint returns the primary URL plus a size manifest. Gallery images save that manifest in `product_images.image_variants`; a colour finish stores its primary `imageUrl` and manifest in the product's `swatches` JSON; homepage hero/category/deal content can keep its primary URL and manifest together in the `store_settings` JSON. Image files live in Supabase Storage; Postgres stores their URLs, object paths, ordering, roles, alt text, and responsive manifests. Product gallery order is retained and the first product image remains the primary photo.

The API requires `20261013000000_product_image_variants.sql` before saving responsive gallery metadata. Checkout also requires `20261014000000_checkout_order_rpc.sql`: it creates orders and order lines in one transaction, checks and reserves inventory under row locks, and restores tracked stock when an order is cancelled or refunded. Apply both after the existing store migrations when you choose to connect Supabase.

## Routes implemented

| Route | Use | Access |
|---|---|---|
| `GET /health` | Readiness and configuration status | Public |
| `GET /api/catalog` | Published products in storefront shape | Public |
| `GET /api/homepage-content` | Saved homepage content | Public |
| `GET /api/reviews?product={slug}` | Published product reviews | Public |
| `POST /api/reviews` | Submit a review for moderation | Signed-in customer |
| `GET /api/reviews?admin=1` | Review inbox | Admin |
| `PATCH /api/reviews` | Change review moderation status | Admin |
| `GET /api/admin/products` | Product editor data | Admin |
| `POST /api/admin/products` | Create or update a product, variants, and gallery | Admin |
| `PATCH /api/admin/products` | Publish, archive, or draft a product | Admin |
| `POST /api/admin/media` | Optimize and upload a product/colour image | Admin |
| `GET`, `PATCH /api/admin/homepage-content` | Read or save homepage content | Admin |
| `GET /api/admin/profit?year={year}` | Monthly and annual gross profit report | Admin |
| `GET`, `PATCH /api/admin/orders` | Read and update saved orders | Admin |
| `GET /api/custom-requests` | Read custom requests and short-lived image links | Admin |
| `POST /api/custom-requests` | Submit a guest custom request and optimized private reference photos | Public form |
| `POST /api/orders` | Create a recalculated checkout order | Guest or signed-in customer |

Order creation re-reads active prices, allowed options, inventory, and cost on the server. Send `customer: {name,email,phone}`, `shipping: {address,city,postalCode}`, `deliveryMethod`, `paymentMethod`, and `items: [{productId,quantity,options:{size,color,fabric,legFinish}}]` to `POST /api/orders`. It does not capture card or bKash payments; those payment integrations need to be added before accepting online payment orders. The admin profit report counts confirmed/processing/shipped/delivered orders and excludes pending, cancelled, and refunded orders.

## Connecting later

The existing storefront still calls the Next.js `/api/*` routes. This service is separate and is not currently connected. When you want to switch over, point the frontend API client to this service, send Supabase access tokens for authenticated calls, and change admin media uploads to send raw file bytes to `/api/admin/media`. The image response's `variants` manifest should be attached to the product image or colour finish before saving. Keep the local Next.js routes until the new API has been configured and verified against a Supabase project.

Orders are written to the existing `orders` and `order_items` tables by the transactional RPC. The database trigger added by `20261012000000_product_cost_profit.sql` snapshots current unit cost for each new order line. The order endpoint marks orders pending; an admin must confirm them before they count in profit reporting. Online payment providers are not configured by this backend.
