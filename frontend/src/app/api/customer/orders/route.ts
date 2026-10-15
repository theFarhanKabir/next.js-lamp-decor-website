import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view your orders." }, { status: 401 });
  const { data, error } = await supabase.from("orders")
    .select("id,order_number,placed_at,status,payment_status,payment_method,total_bdt,courier_tracking_code,courier_status,courier_return_status,courier_message,courier_updated_at,order_status_events(id,from_status,to_status,created_at,note),order_items(product_name,quantity)")
    .eq("customer_id", user.id).order("placed_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Your order history could not be loaded." }, { status: 502 });
  return NextResponse.json({ orders: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
