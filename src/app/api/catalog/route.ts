import { NextResponse } from "next/server";
import { createPublicClient } from "../../../lib/supabase/server";
import { PRODUCTS, type Product } from "../../catalog";

// Local catalogue remains the graceful fallback until Supabase is configured.
export async function GET() {
  const supabase = createPublicClient();
  if (!supabase) return NextResponse.json({ products: PRODUCTS, categories: [], source: "fallback" });

  const [{ data, error }, { data: categoryRows, error: categoryError }] = await Promise.all([supabase
    .from("products")
      .select("id,category_id,subcategory_id,name,slug,short_description,description,price_bdt,compare_at_price_bdt,status,made_to_order,lead_time,attributes,swatches,sort_order,category:categories!products_category_id_fkey(name,slug),subcategory:categories!products_subcategory_id_category_id_fkey(name,slug),product_images(public_url,alt_text,image_role,sort_order,image_variants)")
    .eq("status", "active")
    .order("sort_order"), supabase.from("categories").select("id,name,slug,parent_id,is_active").eq("is_active", true).order("sort_order")]);
  if (error) return NextResponse.json({ products: PRODUCTS, categories: [], source: "fallback" });
  const parents = new Map((categoryRows ?? []).filter((row) => !row.parent_id).map((row) => [row.id, row]));
  const categories = categoryError ? [] : (categoryRows ?? []).filter((row) => row.parent_id).map((row) => ({
    name: row.name,
    slug: row.slug,
    parentSlug: parents.get(row.parent_id)?.slug ?? "",
    parentName: parents.get(row.parent_id)?.name ?? "",
  }));

  const products: Product[] = (data ?? []).map((row: any) => {
    const images = [...(row.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
    const responsiveSet = (image: any) => (Array.isArray(image?.image_variants) ? image.image_variants : [])
      .filter((variant: any) => Number.isInteger(variant?.width) && variant.width > 0 && typeof variant.url === "string")
      .map((variant: any) => `${variant.url} ${variant.width}w`).join(", ") || undefined;
    const primary = images.find((image: any) => image.image_role === "product") ?? images[0];
    const lifestyle = images.find((image: any) => image.image_role === "lifestyle") ?? images[1] ?? primary;
    const attrs = row.attributes ?? {};
    const category = row.category?.name === "Lamps" ? "Lighting" : row.category?.name ?? "Lighting";
    return {
      id: row.slug, name: row.name, category, categorySlug: row.category?.slug, subcategory: row.subcategory?.name ?? row.category?.name ?? "", subcategorySlug: row.subcategory?.slug,
      description: row.description || row.short_description || "", badge: row.compare_at_price_bdt ? "sale" : attrs.special_edition ? "new" : attrs.badge,
      basePrice: Math.round(Number(row.compare_at_price_bdt ?? row.price_bdt) * 100), salePrice: row.compare_at_price_bdt ? Math.round(Number(row.price_bdt) * 100) : undefined,
      rating: attrs.rating, reviewCount: attrs.reviewCount, swatches: row.swatches ?? [],
      images: { silo: primary?.public_url ?? attrs.imageUrl ?? "", lifestyle: lifestyle?.public_url ?? "", siloSrcSet: responsiveSet(primary), lifestyleSrcSet: responsiveSet(lifestyle) },
      imageVariants: Object.fromEntries(images.map((image: any) => [image.public_url, Array.isArray(image.image_variants) ? image.image_variants : []])),
      gallery: images.map((image: any) => image.public_url),
      sizes: (attrs.sizes ?? []).map((option: any) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
      fabrics: (attrs.fabrics ?? []).map((option: any) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
      legs: (attrs.legs ?? []).map((option: any) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
      materials: attrs.materials ?? [], dimensions: attrs.dimensions ?? {}, sizeDimensions: attrs.sizeDimensions ?? {}, materialDetails: attrs.materialDetails ?? {},
      orderType: row.made_to_order ? "made-to-order" : "in-stock", leadTime: row.lead_time ?? undefined,
    };
  });
  // Once Supabase responds successfully, it is the catalogue source of truth.
  // Keeping local fallbacks merged here would make archived products reappear.
  return NextResponse.json({ products, categories, source: "supabase" }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
