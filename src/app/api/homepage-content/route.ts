import { NextResponse } from "next/server";
import { createPublicClient } from "../../../lib/supabase/server";
import { DEFAULT_HOMEPAGE_CONTENT } from "../../homepage-content";

export async function GET() {
  const supabase = createPublicClient();
  const cacheHeaders = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (!supabase) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" }, { headers: cacheHeaders });
  const { data, error } = await supabase.from("store_settings").select("value").eq("key", "homepage_content").maybeSingle();
  if (error) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" });
  if (!data?.value) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" }, { headers: cacheHeaders });
  const savedArrivals = data.value.newArrivals;
  const newArrivals = Array.isArray(savedArrivals)
    ? { ...DEFAULT_HOMEPAGE_CONTENT.newArrivals, productIds: savedArrivals }
    : savedArrivals && typeof savedArrivals === "object"
      ? { ...DEFAULT_HOMEPAGE_CONTENT.newArrivals, ...savedArrivals }
      : DEFAULT_HOMEPAGE_CONTENT.newArrivals;
  const content = { ...DEFAULT_HOMEPAGE_CONTENT, ...data.value, newArrivals };
  return NextResponse.json({ content, source: "supabase" }, { headers: cacheHeaders });
}
