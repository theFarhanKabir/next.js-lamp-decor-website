import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StorefrontRoute from "../storefront-route";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = { title: "My account | Cloud Lamps & Mirrors" };

export default async function AccountPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) redirect("/login?next=/account");
  }
  return <StorefrontRoute />;
}
