import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";

export async function POST() {
  const supabase = await createClient({ admin: true });
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in with an administrator account." }, { status: 401 });
  if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  return NextResponse.json({ error: "Steadfast shipment actions require the standalone backend. Configure NEXT_PUBLIC_BACKEND_URL and the server-only Steadfast credentials, then retry." }, { status: 503 });
}
