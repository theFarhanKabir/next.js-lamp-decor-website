import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

async function adminClient() {
  const supabase = await createClient({ admin: true });
  if (!supabase) return { response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in with an administrator account." }, { status: 401 }) };
  if (user.app_metadata?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { supabase };
}

export async function GET() {
  const { supabase, response } = await adminClient();
  if (response) return response;
  const { data, error } = await supabase.from("categories")
    .select("id,name,slug,parent_id,is_fixed,is_active,sort_order")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const { supabase, response } = await adminClient();
  if (response) return response;
  let body: { id?: unknown; name?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!id || !name || name.length > 80) return NextResponse.json({ error: "A subcategory and a name up to 80 characters are required." }, { status: 400 });

  const { data: category, error: lookupError } = await supabase.from("categories")
    .select("id,parent_id,is_fixed").eq("id", id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!category || !category.parent_id || category.is_fixed) return NextResponse.json({ error: "Only subcategories can be renamed." }, { status: 400 });
  const { data: duplicate, error: duplicateError } = await supabase.from("categories")
    .select("id").eq("parent_id", category.parent_id).ilike("name", name).neq("id", id).maybeSingle();
  if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  if (duplicate) return NextResponse.json({ error: "A subcategory with that name already exists in this department." }, { status: 409 });

  const { data, error } = await supabase.from("categories").update({ name })
    .eq("id", id).select("id,name,slug,parent_id,is_fixed,is_active,sort_order").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data });
}

export async function POST(request: Request) {
  const { supabase, response } = await adminClient();
  if (response) return response;
  let body: { parentId?: unknown; name?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parentId = typeof body.parentId === "string" ? body.parentId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (!parentId || !name || name.length > 80 || !slug) return NextResponse.json({ error: "Choose a department and enter a valid subcategory name." }, { status: 400 });
  const { data: parent, error: parentError } = await supabase.from("categories")
    .select("id,parent_id,is_fixed").eq("id", parentId).maybeSingle();
  if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 });
  if (!parent || parent.parent_id || !parent.is_fixed) return NextResponse.json({ error: "Choose one of the fixed store departments." }, { status: 400 });
  const { data: category, error } = await supabase.from("categories")
    .insert({ parent_id: parentId, name, slug, is_fixed: false, is_active: true, sort_order: 999 })
    .select("id,name,slug,parent_id,is_fixed,is_active,sort_order").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A category with this name or URL already exists." : error.message }, { status: 400 });
  return NextResponse.json({ category }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, response } = await adminClient();
  if (response) return response;
  let body: { id?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "A subcategory is required." }, { status: 400 });

  const { data: category, error: lookupError } = await supabase.from("categories")
    .select("id,parent_id,is_fixed").eq("id", id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!category || !category.parent_id || category.is_fixed) {
    return NextResponse.json({ error: "Only subcategories can be removed. Main departments are protected." }, { status: 400 });
  }

  const { count, error: productError } = await supabase.from("products")
    .select("id", { count: "exact", head: true }).eq("subcategory_id", id);
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
  if (count) {
    return NextResponse.json({ error: `This subcategory is assigned to ${count} product${count === 1 ? "" : "s"}. Reassign those products before removing it.` }, { status: 409 });
  }

  const { error: deleteError } = await supabase.from("categories").delete().eq("id", id);
  if (deleteError) {
    const message = deleteError.code === "23503"
      ? "This subcategory is still in use. Reassign its products before removing it."
      : deleteError.message;
    return NextResponse.json({ error: message }, { status: deleteError.code === "23503" ? 409 : 400 });
  }
  return NextResponse.json({ ok: true, id });
}
