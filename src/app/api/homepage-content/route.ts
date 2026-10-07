import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { DEFAULT_HOMEPAGE_CONTENT } from "../../homepage-content";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" });
  const { data, error } = await supabase.from("store_settings").select("value").eq("key", "homepage_content").maybeSingle();
  if (error || !data?.value) return NextResponse.json({ content: DEFAULT_HOMEPAGE_CONTENT, source: "defaults" });
  return NextResponse.json({ content: data.value, source: "supabase" });
}
