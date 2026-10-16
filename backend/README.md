# Cloud Lamps API

Standalone Node.js API for the storefront and admin data model. The Next.js browser client can use it for `/api/*` requests when `NEXT_PUBLIC_BACKEND_URL` is set. Both services use the same Supabase project.

## Runtime

- Production target: Node.js **24.21.0 LTS**, pinned in `.nvmrc`.
- `npm ci` (from `backend/`)
- The service reads the parent project's `.env.local`; an optional `backend/.env` overrides those values.
- `npm run dev` starts the API; `npm run dev:watch` starts it with file watching; `npm start` starts it normally.
- `npm run check` checks the JavaScript module syntax.
- Default local address: `http://127.0.0.1:4000`.

The latest Node.js Current line is newer than LTS. This backend targets the newest LTS release for a supported production runtime while remaining compatible with later Node 26 releases.

## Configuration and database checks

The service accepts either the backend names (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) or the root Next.js names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`). The secret is read only by Node and never included in the frontend bundle. The process does not make a Supabase request at startup. `/health` reports configuration presence without exposing credentials; use `/api/catalog` to verify a database read.

Admin requests send a verified Supabase access token as `Authorization: Bearer <token>`; the API checks the token with Supabase Auth and then requires the trusted `app_metadata.role = "admin"` claim. Order creation requires a verified signed-in customer. The custom request form remains available to guests.

`ALLOWED_ORIGINS` defaults to `http://localhost:3000` for local development. Set it to the exact trusted site origins in production. There is no wildcard credentialed CORS.

## Deploy this API to Render

The repository's root `render.yaml` defines this API as a Render web service. In Render, create a new Blueprint from the GitHub repository and provide `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `ALLOWED_ORIGINS` when prompted. Set `ALLOWED_ORIGINS` to the exact frontend origin, including `https://` and without a trailing slash. The Blueprint uses `backend/` as its root, binds the service to `0.0.0.0`, installs from the backend lockfile, starts with `npm start`, and checks `/health`.

After the API deploys, set the frontend's `NEXT_PUBLIC_BACKEND_URL` to its public HTTPS origin (for example, `https://cloud-lamps-api.onrender.com`) and redeploy the frontend so the URL is included in the browser build. The frontend API client then attaches the signed-in user's Supabase access token to backend requests. Keep `SUPABASE_SECRET_KEY`, payment credentials, courier credentials, and SMS hook credentials only in the Render environment; never use a `NEXT_PUBLIC_` prefix for them.

The Blueprint selects Render's Free plan for preview/testing. Free web services sleep after 15 minutes without traffic and can take about a minute to wake. Render says its free instances are not for production. MiMSMS requires a stable allowlisted outbound IP; Render dedicated outbound IPs require a paid plan, so confirm MiMSMS can accept Render's shared regional IP ranges before using Render Free for SMS delivery.

## Phone authentication with MiMSMS

Supabase Auth creates and verifies phone OTPs. Its signed Send SMS Auth Hook sends each generated OTP to this API at `POST /api/hooks/supabase/send-sms`; the API verifies Supabase's Standard Webhooks signature, formats Bangladeshi numbers as `8801…`, and sends one transactional (`T`) SMS through `https://api.mimsms.com/api/V2/SMS`. The API key, OTP, and hook signing secret remain server-side. The hook rejects requests with invalid or expired signatures and does not log OTP values.

Set these server-only variables in the root `.env.local` or `backend/.env`:

- `MIMSMS_USERNAME` — the email used to sign in to the MiMSMS panel.
- `MIMSMS_API_KEY` — the active MiMSMS API key.
- `MIMSMS_SENDER_NAME` — the exact Sender ID shown in MiMSMS.
- `SUPABASE_SEND_SMS_HOOK_SECRETS` — the complete `v1,whsec_...` secret generated when configuring the HTTP hook in Supabase.

The Supabase project must be able to reach a **public HTTPS** API URL. Localhost is not reachable from hosted Supabase Auth. MiMSMS also requires the API server's source IP and domain to be allowlisted, so deploy behind a stable outbound IP and whitelist that IP and domain in **MiMSMS → Utility → Developer**. An ordinary local or serverless dynamic egress IP may not satisfy MiMSMS's whitelist requirement. Select the approved Sender ID in **MiMSMS → Utility → Sender ID**.

In Supabase, enable the **Phone** provider and phone confirmation, then open **Authentication → Hooks**, add an HTTP **Send SMS** hook for `https://YOUR_API_HOST/api/hooks/supabase/send-sms`, and copy its full signing secret into `SUPABASE_SEND_SMS_HOOK_SECRETS` on the API host. Keep the hook secret and MiMSMS API key out of all `NEXT_PUBLIC_*` variables. Set a reasonable SMS rate limit and enable CAPTCHA/bot protection before opening signup publicly. The login UI accepts Bangladesh mobile numbers and six-digit OTPs.

## Image handling

`POST /api/admin/media` accepts the raw file bytes (not multipart) with the original image content type and headers `Authorization`, `X-Image-Role: product|color|hero|category|deal`, and optional `X-Product-Slug` and `X-Image-Alt`. It checks actual image metadata, accepts JPG/PNG/WebP/AVIF up to the configured byte limit, applies EXIF orientation, rejects images above 40 megapixels, and converts without cropping or enlarging to transparent-capable WebP responsive sizes up to 1600 px. EXIF metadata is stripped. Product and colour objects are placed under `products/{slug}/{upload-id}/{width}.webp`; homepage media is placed under `homepage/{role}/{upload-id}/{width}.webp` in `store-media` with immutable caching.

The endpoint returns the primary URL plus a size manifest. Gallery images save that manifest in `product_images.image_variants`; a colour finish stores its primary `imageUrl` and manifest in the product's `swatches` JSON; homepage hero/category/deal content can keep its primary URL and manifest together in the `store_settings` JSON. Image files live in Supabase Storage; Postgres stores their URLs, object paths, ordering, roles, alt text, and responsive manifests. Product gallery order is retained and the first product image remains the primary photo.

Responsive gallery metadata requires `20261013000000_product_image_variants.sql`. Checkout and customer persistence use ordered migrations through `20261016000000_customer_checkout_features.sql` to create orders and lines transactionally, reserve and restore stock, persist signed-in carts and wishlists, and redeem coupons and rewards atomically. Payment confirmations are validated with SSLCOMMERZ before changing order payment state. Confirm all migrations appear in `supabase migration list` before enabling checkout.

## Steadfast courier

Add `STEADFAST_API_KEY` and `STEADFAST_SECRET_KEY` to the server environment only, then restart this API. Never use a `NEXT_PUBLIC_` prefix for courier credentials. Apply `20261017000000_steadfast_courier.sql` before using the courier actions. The API sends confirmed/processing COD orders with their payable total, and online orders only after payment is confirmed (with `cod_amount: 0`). The admin Orders page creates a consignment or syncs its status. Submission reservations and the unique `CL-{order_number}` invoice prevent normal duplicate clicks; if a request times out, the order is marked `submission_unknown` and must be synced before another create attempt. Courier status remains separate from the store's order/payment status: staff decide when a failed or cancelled delivery should change the order. For delivered or partially delivered consignments, admins can submit one Steadfast return request; its status is shown separately.

For live status notifications, configure Steadfast to POST to `{PUBLIC_API_URL}/api/webhooks/steadfast` and set the same random `STEADFAST_WEBHOOK_TOKEN` in this API and Steadfast's webhook bearer-token field. The webhook token is separate from the API key. Tracking status and code are visible to the admin and to the signed-in customer who owns the order. A tracking code is shown as provided by Steadfast; no tracking URL is constructed because the create-order response does not document one.

Local development requires the Node API on port 4000 and `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` in the Next.js environment for admin courier actions. Set `PUBLIC_API_URL` to the deployed HTTPS API origin when configuring the production webhook.

## Routes implemented

| Route | Use | Access |
|---|---|---|
| `GET /health` | Readiness and configuration status | Public |
| `GET /api/catalog` | Published products and active subcategories in storefront shape | Public |
| `GET /api/homepage-content` | Saved homepage content | Public |
| `GET /api/admin/overview` | Live order, customer, product, and monthly sales totals | Admin |
| `GET /api/admin/customers` | Registered customers with confirmed order summaries | Admin |
| `GET /api/reviews?product={slug}` | Published product reviews | Public |
| `POST /api/reviews` | Submit a review for moderation | Signed-in customer |
| `GET /api/reviews?admin=1` | Review inbox | Admin |
| `PATCH /api/reviews` | Change review moderation status | Admin |
| `GET`, `POST`, `PATCH`, `DELETE /api/admin/categories` | List, add, rename, or remove subcategories under the four fixed departments | Admin |
| `GET`, `POST`, `PATCH`, `DELETE /api/admin/coupons` | Manage coupon records and protect coupons with redemption history | Admin |
| `GET`, `PATCH /api/admin/rewards` | Read reward ledger totals and save programme settings | Admin |
| `GET`, `PATCH /api/admin/settings` | Read and save the store profile | Admin |
| `GET /api/admin/products` | Product editor data | Admin |
| `POST /api/admin/products` | Create or update a product, variants, and gallery | Admin |
| `PATCH`, `DELETE /api/admin/products` | Change product status or safely delete a product without order/review history | Admin |
| `GET`, `POST /api/admin/media` | List media and optimize/upload an image to store storage | Admin |
| `GET`, `PATCH /api/admin/homepage-content` | Read or save homepage content | Admin |
| `GET /api/admin/profit?year={year}` | Monthly and annual gross profit report | Admin |
| `GET`, `PATCH /api/admin/orders` | Read and update saved orders | Admin |
| `POST /api/admin/orders/steadfast` | Create/sync a shipment or create a return request | Admin |
| `POST /api/webhooks/steadfast` | Receive authenticated delivery/tracking updates | Steadfast callback |
| `GET`, `PUT /api/customer/state` | Persist a signed-in customer's cart and wishlist across devices | Customer |
| `GET /api/customer/rewards` | Read the signed-in customer's available rewards | Customer |
| `GET /api/customer/orders` | Read the signed-in customer's order and courier tracking details | Customer |
| `POST /api/coupons/validate` | Preview a coupon against the current subtotal | Public |
| `POST /api/payments/sslcommerz/init` | Recalculate and save a bKash order, then create hosted checkout | Signed-in customer |
| `GET /api/payments/sslcommerz/status?tran_id={id}` | Read minimal payment status for the returned transaction | Public, high-entropy transaction ID |
| `POST /api/payments/sslcommerz/{success,fail,cancel,ipn}` | Receive callbacks and IPN; verify against SSLCOMMERZ | Provider callback |
| `GET /api/custom-requests` | Read custom requests and short-lived image links | Admin |
| `POST /api/custom-requests` | Submit a guest custom request and optimized private reference photos | Public form |
| `POST /api/orders` | Create a recalculated cash-on-delivery order | Signed-in customer |

Order creation requires a verified Supabase customer session and re-reads active prices and allowed options on the server. Cash on delivery uses `POST /api/orders`; bKash uses `/api/payments/sslcommerz/init`, which recalculates the order and reserves stock, coupon use, and reward redemption atomically. The customer completes bKash payment on SSLCOMMERZ Hosted Checkout. The backend independently checks transaction ID, amount, BDT currency, provider status, and risk before changing payment state. Risk flagged payments are recorded as paid but remain pending for store review; safe validated payments are automatically confirmed.

### SSLCOMMERZ setup

Create a merchant account with SSLCOMMERZ and enable bKash for the store. Use sandbox credentials while developing. Put the following server-only values in the root `.env.local` (read by the backend) or `backend/.env`. Never prefix gateway credentials with `NEXT_PUBLIC_`:

- `SSLCOMMERZ_STORE_ID`
- `SSLCOMMERZ_STORE_PASSWORD`
- `SSLCOMMERZ_IS_LIVE=false` for sandbox, `true` only after live approval
- `PUBLIC_API_URL=https://your-public-api-host` (base URL without `/api`; the callbacks and IPN must reach this Node API over HTTPS)
- `PUBLIC_SITE_URL=http://localhost:3000` locally or your deployed storefront origin

Set `NEXT_PUBLIC_BACKEND_URL` to the browser-reachable API URL and add the storefront origin to `ALLOWED_ORIGINS`. Restart the backend after environment changes. Configure `/api/payments/sslcommerz/ipn` in the merchant panel if requested. A sandbox callback cannot reach a private `127.0.0.1` address; use an HTTPS tunnel or deployed API. The gateway accepts BDT 10 through BDT 500,000. A provider failure is closed only after its transaction query confirms it; unverified returns remain pending for reconciliation.

## Local frontend and backend startup

Set `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4000` in the root `.env.local`, then restart Next.js. In separate terminals, start Next.js from `frontend/` with `npm run dev` and this API from `backend/` with `npm run dev`. The shared frontend API client sends the signed-in user's Supabase access token to this API. Admin product photos, finish photos, homepage images, and media-library uploads use the optimized raw upload route when the backend URL is configured. Without it, the browser generates responsive WebP sizes before uploading directly to Supabase Storage with the signed-in admin session.

Orders are written to the existing `orders` and `order_items` tables by the transactional RPC. The database trigger added by `20261012000000_product_cost_profit.sql` snapshots current unit cost for each new order line. Homepage defaults are seeded only if no saved admin configuration exists; an administrator can replace them from **Admin → Homepage content → Save homepage**. The admin profit report excludes pending, cancelled, and refunded orders.
