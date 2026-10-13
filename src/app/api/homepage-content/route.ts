import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "../../../lib/supabase/server";
import { DEFAULT_HOMEPAGE_CONTENT } from "../../homepage-content";

export async function GET() {
  const supabase = createPublicClient();
  const cacheHeaders = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (!supabase) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" }, { headers: cacheHeaders });
  // This project does not yet have generated Supabase Database types, so keep
  // this dynamic settings-table query typed at its boundary instead of letting
  // the untyped client infer `never` for the row.
  const { data, error } = await (supabase as SupabaseClient)
    .from("store_settings")
    .select("value")
    .eq("key", "homepage_content")
    .maybeSingle();
  if (error) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" });
  if (!data?.value) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" }, { headers: cacheHeaders });
  const savedContent = typeof data.value === "object" && !Array.isArray(data.value)
    ? data.value as Record<string, unknown>
    : {};
  const savedArrivals = savedContent.newArrivals;
  const newArrivals = Array.isArray(savedArrivals)
    ? { ...DEFAULT_HOMEPAGE_CONTENT.newArrivals, productIds: savedArrivals }
    : savedArrivals && typeof savedArrivals === "object" && !Array.isArray(savedArrivals)
      ? { ...DEFAULT_HOMEPAGE_CONTENT.newArrivals, ...savedArrivals as Record<string, unknown> }
      : DEFAULT_HOMEPAGE_CONTENT.newArrivals;
  const content = { ...DEFAULT_HOMEPAGE_CONTENT, ...savedContent, newArrivals };
  return NextResponse.json({ content, source: "supabase" }, { headers: cacheHeaders });
}
