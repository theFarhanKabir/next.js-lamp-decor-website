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

function getProductStoragePath(image: { public_url: string; storage_path?: string | null }) {
  if (image.storage_path?.startsWith("products/")) return image.storage_path;
  try {
    const pathname = new URL(image.public_url).pathname;
    const marker = "/storage/v1/object/public/store-media/";
    const index = pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(pathname.slice(index + marker.length));
    return path.startsWith("products/") ? path : null;
  } catch { return null; }
}

export async function GET() {
  const { supabase, response } = await adminClient();
  if (response) return response;
  const { data, error } = await supabase.from("products").select("*, category:categories!products_category_id_fkey(name,slug), subcategory:categories!products_subcategory_id_category_id_fkey(name,slug), product_images(*)").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const { supabase, response } = await adminClient();
  if (response) return response;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")).trim();
  const price = Number(body.price_bdt);
  if (!name || !slug || !Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Product name, URL slug, and a valid price are required." }, { status: 400 });
  const { data: category, error: categoryError } = await supabase.from("categories").select("id, parent_id").eq("slug", body.category_slug).single();
  if (categoryError || !category) return NextResponse.json({ error: "Choose a valid department." }, { status: 400 });
  let subcategoryId: string | null = null;
  const subcategoryName = String(body.subcategory_name ?? "").trim();
  if (subcategoryName) {
    const subcategorySlug = subcategoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!subcategorySlug) return NextResponse.json({ error: "Enter a valid subcategory name." }, { status: 400 });
    const parentId = category.parent_id ?? category.id;
    const { data: existingSubcategory, error: lookupError } = await supabase
      .from("categories").select("id").eq("slug", subcategorySlug).eq("parent_id", parentId).maybeSingle();
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
    if (existingSubcategory) subcategoryId = existingSubcategory.id;
    else {
      const { data: createdSubcategory, error: createError } = await supabase.from("categories")
        .insert({ parent_id: parentId, name: subcategoryName, slug: subcategorySlug, sort_order: 0, is_fixed: false, is_active: true })
        .select("id").single();
      if (createError) return NextResponse.json({ error: `Could not save this subcategory: ${createError.message}` }, { status: 400 });
      subcategoryId = createdSubcategory.id;
    }
  }
  const costPrice = body.cost_price_bdt === "" || body.cost_price_bdt == null ? null : Number(body.cost_price_bdt);
  if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) return NextResponse.json({ error: "Enter a valid product unit cost." }, { status: 400 });
  const record = {
    name, slug, sku: body.sku || null, category_id: category.parent_id ?? category.id, subcategory_id: subcategoryId,
    short_description: body.short_description || null, description: body.description || "", price_bdt: price, cost_price_bdt: costPrice,
    compare_at_price_bdt: body.compare_at_price_bdt ? Number(body.compare_at_price_bdt) : null,
    inventory_quantity: Math.max(0, Number(body.inventory_quantity) || 0), track_inventory: Boolean(body.track_inventory),
    status: body.status === "active" ? "active" : "draft", made_to_order: Boolean(body.made_to_order), lead_time: body.lead_time || null,
    attributes: body.attributes ?? {}, swatches: body.swatches ?? [], is_featured: Boolean(body.is_featured), published_at: body.status === "active" ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase.from("products").upsert(record, { onConflict: "slug" }).select("id,slug").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const images = Array.isArray(body.images) ? body.images.filter((image: any) => image?.url).map((image: any, index: number) => ({ product_id: data.id, public_url: image.url, storage_path: image.storagePath ?? image.storage_path ?? null, image_variants: Array.isArray(image.variants) ? image.variants : Array.isArray(image.image_variants) ? image.image_variants : [], alt_text: image.alt || name, image_role: image.role === "lifestyle" ? "lifestyle" : "product", sort_order: index })) : [];
  const { error: deleteError } = await supabase.from("product_images").delete().eq("product_id", data.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  if (images.length) {
    const { error: imageError } = await supabase.from("product_images").insert(images);
    if (imageError) return NextResponse.json({ error: imageError.message }, { status: 400 });
  }
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, response } = await adminClient();
  if (response) return response;
  const { slug, status } = await request.json();
  if (!slug || !["draft", "active", "archived"].includes(status)) return NextResponse.json({ error: "A product slug and valid status are required." }, { status: 400 });
  const { error } = await supabase.from("products").update({ status, published_at: status === "active" ? new Date().toISOString() : null }).eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, response } = await adminClient();
  if (response) return response;
  let body: { slug?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) return NextResponse.json({ error: "A product slug is required." }, { status: 400 });

  const { data: product, error: lookupError } = await supabase.from("products")
    .select("id,slug").eq("slug", slug).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const [{ count: orderCount, error: orderError }, { count: reviewCount, error: reviewError }] = await Promise.all([
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", product.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("product_id", product.id),
  ]);
  if (orderError || reviewError) return NextResponse.json({ error: orderError?.message ?? reviewError?.message }, { status: 500 });
  if (orderCount || reviewCount) {
    return NextResponse.json({ error: "This product has order or review history. Archive it instead to preserve those records." }, { status: 409 });
  }

  const { data: productImages, error: imageError } = await supabase.from("product_images")
    .select("public_url,storage_path").eq("product_id", product.id);
  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });
  const imageUrls = [...new Set((productImages ?? []).map((image) => image.public_url))];
  const [{ data: sharedImages, error: sharedImageError }, { data: homepageSetting, error: homepageError }] = await Promise.all([
    imageUrls.length
      ? supabase.from("product_images").select("public_url").in("public_url", imageUrls).neq("product_id", product.id)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("store_settings").select("value").eq("key", "homepage_content").maybeSingle(),
  ]);
  if (sharedImageError || homepageError) {
    return NextResponse.json({ error: sharedImageError?.message ?? homepageError?.message }, { status: 500 });
  }
  const sharedUrls = new Set((sharedImages ?? []).map((image) => image.public_url));
  const homepageValue = JSON.stringify(homepageSetting?.value ?? null);
  const storagePaths = [...new Set((productImages ?? [])
    .filter((image) => !sharedUrls.has(image.public_url) && !homepageValue.includes(image.public_url))
    .map((image) => getProductStoragePath(image))
    .filter((path): path is string => Boolean(path)))];

  const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
  if (deleteError) {
    const message = deleteError.code === "23503"
      ? "This product is still referenced by store records. Archive it instead."
      : deleteError.message;
    return NextResponse.json({ error: message }, { status: deleteError.code === "23503" ? 409 : 400 });
  }
  const { error: storageError } = storagePaths.length
    ? await supabase.storage.from("store-media").remove(storagePaths)
    : { error: null };
  return NextResponse.json({
    ok: true,
    slug: product.slug,
    ...(storageError ? { warning: "The product was deleted, but one or more uploaded images could not be removed from Storage." } : {}),
  });
}
