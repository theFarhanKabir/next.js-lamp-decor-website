import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { PRODUCTS } from "../../catalog";
import { createClient as createSessionClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

type ReviewStatus = "pending" | "published" | "hidden";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function requireAdmin() {
  const session = await createSessionClient();
  if (!session) return { error: errorResponse("Supabase is not configured.", 503) };
  const { data: { user }, error } = await session.auth.getUser();
  if (error || user?.app_metadata?.role !== "admin") return { error: errorResponse("Admin access is required.", 403) };
  const service = createServiceClient();
  if (!service) return { error: errorResponse("The server Supabase service key is not configured.", 503) };
  return { service };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("admin") === "1") {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const { data, error } = await admin.service
      .from("reviews")
      .select("id, product_slug, customer_name, rating, title, body, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return errorResponse("Could not load customer reviews. Apply the latest Supabase migration and try again.", 500);
    return NextResponse.json({ reviews: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const slug = url.searchParams.get("product")?.trim() ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !PRODUCTS.some((product) => product.id === slug)) return errorResponse("A valid product is required.", 400);
  const session = await createSessionClient();
  if (!session) return errorResponse("Supabase is not configured.", 503);
  const { data, error } = await session
    .from("reviews")
    .select("id, product_slug, customer_name, rating, title, body, created_at")
    .eq("product_slug", slug)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) return errorResponse("Could not load product reviews. Apply the latest Supabase migration and try again.", 500);
  return NextResponse.json({ reviews: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const session = await createSessionClient();
  if (!session) return errorResponse("Supabase is not configured.", 503);
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) return errorResponse("Sign in to write a product review.", 401);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Please check the review details and try again.", 400);
  }
  if (!input || typeof input !== "object") return errorResponse("Please check the review details and try again.", 400);
  const values = input as Record<string, unknown>;
  const slug = typeof values.productSlug === "string" ? values.productSlug.trim() : "";
  const title = typeof values.title === "string" ? values.title.trim() : "";
  const body = typeof values.body === "string" ? values.body.trim() : "";
  const rating = Number(values.rating);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !PRODUCTS.some((product) => product.id === slug)) return errorResponse("A valid product is required.", 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return errorResponse("Choose a rating from 1 to 5 stars.", 400);
  if (title.length > 100) return errorResponse("Keep the review title under 100 characters.", 400);
  if (body.length < 10 || body.length > 3000) return errorResponse("Write between 10 and 3,000 characters for your review.", 400);

  const service = createServiceClient();
  let productId: string | null = null;
  if (service) {
    const { data: product } = await service.from("products").select("id").eq("slug", slug).maybeSingle();
    productId = product?.id ?? null;
  }
  const name = typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim().slice(0, 120)
    : (user.email?.split("@")[0] || "Customer").slice(0, 120);

  const { data, error } = await session.from("reviews").insert({
    product_id: productId,
    product_slug: slug,
    customer_id: user.id,
    customer_name: name,
    rating,
    title: title || null,
    body,
    status: "pending" satisfies ReviewStatus,
  }).select("id").single();

  if (error?.code === "23505") return errorResponse("You have already submitted a review for this product.", 409);
  if (error || !data) return errorResponse("Your review could not be submitted. Please try again shortly.", 500);
  return NextResponse.json({ success: true, message: "Thanks — your review is awaiting approval." }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!validOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Please try again.", 400);
  }
  if (!input || typeof input !== "object") return errorResponse("Please try again.", 400);
  const { id, status } = input as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return errorResponse("A valid review is required.", 400);
  if (status !== "published" && status !== "hidden" && status !== "pending") return errorResponse("Choose a valid review status.", 400);
  const { error } = await admin.service.from("reviews").update({ status }).eq("id", id);
  if (error) return errorResponse("Could not update this review.", 500);
  return NextResponse.json({ success: true });
}
