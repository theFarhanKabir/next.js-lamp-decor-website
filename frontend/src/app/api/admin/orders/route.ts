import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "../../../../lib/supabase/server";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function adminService() {
  const session = await createSessionClient({ admin: true });
  if (!session) return { response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in with an administrator account." }, { status: 401 }) };
  if (user.app_metadata?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  const service = createServiceClient();
  if (!service) return { response: NextResponse.json({ error: "The server Supabase service key is not configured." }, { status: 503 }) };
  return { service, user };
}

export async function GET() {
  const { service, response } = await adminService();
  if (response) return response;
  const { data, error } = await service.from("orders")
    .select("*,order_items(id,product_name,product_sku,quantity,unit_price_bdt,line_total_bdt,selected_options),order_status_events(id,from_status,to_status,actor_email,note,created_at)")
    .order("placed_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load orders. Apply the latest Supabase migration and try again." }, { status: 500 });
  const ids = (data ?? []).map((order) => order.id);
  const { data: payments, error: paymentError } = ids.length
    ? await service.from("payment_transactions").select("order_id,status,risk_level").in("order_id", ids)
    : { data: [], error: null };
  if (paymentError) return NextResponse.json({ error: "Order payment status could not be loaded." }, { status: 500 });
  const byOrder = new Map((payments ?? []).map((payment) => [payment.order_id, payment]));
  return NextResponse.json({ orders: (data ?? []).map((order) => ({ ...order, payment_transaction: byOrder.get(order.id) ?? null })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const { service, user, response } = await adminService();
  if (response) return response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Choose a valid order." }, { status: 400 });
  const note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 4000) || null : null;
  const refund = body.action === "record_refund";
  if (!refund && (typeof body.status !== "string" || !["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"].includes(body.status))) {
    return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });
  }
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  if (refund && (!reference || reference.length > 120)) return NextResponse.json({ error: "Enter the completed refund transaction reference." }, { status: 400 });
  const { data, error } = await service.rpc(refund ? "admin_record_order_refund" : "admin_change_order_status", refund ? {
    p_order_id: id, p_reference: reference, p_actor_user_id: user.id, p_actor_email: user.email ?? "Admin", p_note: note,
  } : {
    p_order_id: id, p_status: body.status, p_actor_user_id: user.id, p_actor_email: user.email ?? "Admin", p_note: note,
  });
  if (error?.code === "P0002") return NextResponse.json({ error: error.message }, { status: 404 });
  if (error?.code === "22023") return NextResponse.json({ error: error.message }, { status: 409 });
  if (error) return NextResponse.json({ error: "The order could not be updated. Apply the latest Supabase migration and try again." }, { status: 500 });
  return NextResponse.json({ ok: true, order: data });
}
