import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { PRODUCTS } from "../../catalog";

// Local catalogue remains the graceful fallback until Supabase is configured.
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ products: PRODUCTS, source: "fallback" });

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories!products_category_id_fkey(name,slug), subcategory:categories!products_subcategory_id_category_id_fkey(name,slug), product_images(public_url,alt_text,image_role,sort_order)")
    .eq("status", "active")
    .order("sort_order");
  if (error) return NextResponse.json({ products: PRODUCTS, source: "fallback", error: error.message });

  const products = (data ?? []).map((row: any) => {
    const images = [...(row.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
    const attrs = row.attributes ?? {};
    const category = row.category?.name === "Lamps" ? "Lighting" : row.category?.name ?? "Lighting";
    return {
      id: row.slug, name: row.name, category, subcategory: row.subcategory?.name ?? row.category?.name ?? "",
      description: row.description || row.short_description || "", badge: row.compare_at_price_bdt ? "sale" : attrs.special_edition ? "new" : attrs.badge,
      basePrice: Math.round(Number(row.compare_at_price_bdt ?? row.price_bdt) * 100), salePrice: row.compare_at_price_bdt ? Math.round(Number(row.price_bdt) * 100) : undefined,
      rating: attrs.rating, reviewCount: attrs.reviewCount, swatches: row.swatches ?? [],
      images: { silo: images.find((image: any) => image.image_role === "product")?.public_url ?? images[0]?.public_url ?? attrs.imageUrl ?? "", lifestyle: images.find((image: any) => image.image_role === "lifestyle")?.public_url ?? images[1]?.public_url ?? images[0]?.public_url ?? "" },
      gallery: images.map((image: any) => image.public_url),
      sizes: (attrs.sizes ?? []).map((option: any) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
      fabrics: (attrs.fabrics ?? []).map((option: any) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
      legs: (attrs.legs ?? []).map((option: any) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })), materials: attrs.materials ?? [], dimensions: attrs.dimensions ?? "",
      orderType: row.made_to_order ? "made-to-order" : "in-stock", leadTime: row.lead_time ?? undefined,
    };
  });
  return NextResponse.json({ products: [...PRODUCTS, ...products.filter((product) => !PRODUCTS.some((local) => local.id === product.id))], source: "supabase" });
}
