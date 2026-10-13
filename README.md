# Cloud Lamps & Mirrors

A storefront built with Next.js 16, React 19, and TypeScript.

## Development

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Standalone Node.js API

The standalone API for catalogue, admin, checkout, orders, and media is in [`backend/`](backend/README.md). It targets Node.js 24.21 LTS and reads the Supabase settings from this project's private `.env.local`. Set `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4000`, then run `npm run dev` from both the project root and `backend/` in separate terminals. See the [backend guide](backend/README.md) for API details and current feature limits.

## Customer accounts

Email registration, sign-in, email confirmation, password reset, and persistent sessions use Supabase Auth.

1. Create a Supabase project and copy its Project URL and Publishable key from **Project Settings → API**.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the Redirect URLs. Add your deployed site URL and its `/auth/callback` URL before production.
4. Restart `npm run dev` after changing environment variables.

The custom request form and admin inbox also require the Supabase migrations in `supabase/migrations/` and a server-only `SUPABASE_SECRET_KEY` in `.env.local` (the legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted). Never put a secret key in a `NEXT_PUBLIC_*` variable. See [the admin setup guide](docs/admin-panel-setup.md).

The public publishable key is intended for browser use; never add a Supabase secret or service-role key to `NEXT_PUBLIC_*` variables. Supabase's default email sender is suitable for trying the flow; configure custom SMTP before relying on registration and password-reset emails in production.

## Routes

- `/` - home
- `/collections` and `/collections/[category]` - product collections
- `/products` - all products
- `/products/[id]` - product details
- `/cart` - shopping bag
- `/wishlist` - saved products
- `/checkout` - checkout
- `/custom-request` - custom product request
- `/admin` - store admin preview and custom request inbox
- `/login` and `/register` - customer sign-in and registration
- `/account` - signed-in customer account
- `/forgot-password` and `/reset-password` - password recovery

## Project layout

- `src/app/` - Next.js App Router pages and storefront UI
- `src/styles/` - global styles, fonts, and theme
- `docs/` - project design reference
