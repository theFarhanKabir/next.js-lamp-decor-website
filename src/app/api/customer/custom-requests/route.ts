import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view your custom requests." }, { status: 401 });
  const { data, error } = await supabase.from("custom_requests")
    .select("id,request_number,status,quoted_price_bdt,created_at,custom_request_status_events(id,from_status,to_status,created_at,note)")
    .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Your custom request status could not be loaded." }, { status: 502 });
  return NextResponse.json({ requests: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
