import { createAdminClient, createClient } from "./supabase/client";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "");

/** Send storefront API requests to the standalone backend when configured.
 * Local Next.js Route Handlers remain available as the default fallback.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!backendUrl) return fetch(path, init);

  const headers = new Headers(init.headers);
  const url = new URL(path, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  const adminRequest = url.pathname.startsWith("/api/admin/")
    || (url.pathname === "/api/custom-requests" && ["GET", "PATCH"].includes((init.method ?? "GET").toUpperCase()))
    || (url.pathname === "/api/reviews" && (url.searchParams.get("admin") === "1" || (init.method ?? "GET").toUpperCase() === "PATCH"));
  const supabase = adminRequest ? createAdminClient() : createClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  return fetch(new URL(path, `${backendUrl}/`), {
    ...init,
    headers,
    credentials: "omit",
  });
}
