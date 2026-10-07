import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import type { HomepageContent } from "../../../homepage-content";

const validImage = (value: unknown) => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
};

function validateContent(value: unknown): value is HomepageContent {
  if (!value || typeof value !== "object") return false;
  const content = value as Partial<HomepageContent>;
  if (!Array.isArray(content.heroSlides) || content.heroSlides.length > 10 || !content.heroSlides.length) return false;
  if (!Array.isArray(content.categories) || content.categories.length > 12 || !content.categories.length) return false;
  if (!Array.isArray(content.hotDeals) || content.hotDeals.length > 30) return false;
  return content.heroSlides.every((item) => item && validImage(item.image) && typeof item.alt === "string" && item.alt.length <= 250 && typeof item.eyebrow === "string" && item.eyebrow.length <= 100 && typeof item.headline === "string" && item.headline.length <= 180 && typeof item.subtext === "string" && item.subtext.length <= 400 && typeof item.ctaLabel === "string" && item.ctaLabel.length <= 80 && typeof item.categorySlug === "string" && typeof item.active === "boolean")
    && content.categories.every((item) => item && validImage(item.image) && typeof item.alt === "string" && item.alt.length <= 250 && typeof item.name === "string" && item.name.length > 0 && item.name.length <= 80 && typeof item.slug === "string" && item.slug.length <= 80 && typeof item.active === "boolean")
    && content.hotDeals.every((item) => item && validImage(item.image) && typeof item.alt === "string" && item.alt.length <= 250 && typeof item.productId === "string" && item.productId.length <= 120 && typeof item.name === "string" && item.name.length <= 120 && typeof item.category === "string" && item.category.length <= 80 && Number.isFinite(item.price) && item.price >= 0 && Number.isFinite(item.was) && item.was >= item.price && typeof item.active === "boolean");
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in with an administrator account." }, { status: 401 });
  if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const body = await request.json();
  if (!validateContent(body.content)) return NextResponse.json({ error: "Homepage content has invalid fields or image URLs." }, { status: 400 });
  const { error } = await supabase.from("store_settings").upsert({ key: "homepage_content", value: body.content }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
