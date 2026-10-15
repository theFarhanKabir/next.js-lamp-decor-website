import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;
let adminBrowserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  browserClient ??= createBrowserClient(url, key);
  return browserClient;
}

/** Admin uses its own cookie so signing into the dashboard never signs a customer into the storefront. */
export function createAdminClient() {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  adminBrowserClient ??= createBrowserClient(url, key, { cookieOptions: { name: "cloud-lamps-admin-auth" }, isSingleton: false });
  return adminBrowserClient;
}
