import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const refreshedCookies = new Map<string, { value: string; options: CookieOptions }>();
  const projectRef = new URL(url).hostname.split(".")[0];
  const customerCookieName = `sb-${projectRef}-auth-token`;

  for (const { admin, cookieName } of [
    { admin: false, cookieName: customerCookieName },
    { admin: true, cookieName: "cloud-lamps-admin-auth" },
  ]) {
    const hasSessionCookie = request.cookies.getAll().some(({ name }) => name === cookieName || name.startsWith(`${cookieName}.`));
    if (!hasSessionCookie) continue;
    const supabase = createServerClient(url, key, {
      ...(admin ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            refreshedCookies.set(name, { value, options });
          });
          response = NextResponse.next({ request });
          refreshedCookies.forEach(({ value, options }, name) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getClaims();
  }
  return response;
}
