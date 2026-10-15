import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const bucket = "custom-request-references";
const maxPhotoBytes = 5 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const sessionClient = await createSessionClient({ admin: true });
  if (!sessionClient) return errorResponse("Supabase is not configured.", 503);

  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || user?.app_metadata?.role !== "admin") return errorResponse("Admin access is required.", 403);

  const supabase = createServiceClient();
  if (!supabase) return errorResponse("The server Supabase service key is not configured.", 503);

  const { data, error } = await supabase
    .from("custom_requests")
    .select("id, request_number, full_name, phone, email, city_area, delivery_address, description, status, admin_note, quoted_price_bdt, created_at, custom_request_status_events(id,from_status,to_status,actor_email,note,created_at), custom_request_images(id, file_name, storage_path, sort_order)")
    .order("created_at", { ascending: false });

  if (error) return errorResponse("Could not load custom requests. Apply the latest Supabase migration and try again.", 500);

  const requests = await Promise.all((data ?? []).map(async (request) => {
    const sortedImages = [...(request.custom_request_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const images = await Promise.all(sortedImages.map(async (image) => {
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(image.storage_path, 60 * 30);
      return { id: image.id, file_name: image.file_name, signed_url: signed?.signedUrl ?? null };
    }));
    return { ...request, images };
  }));

  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  const sessionClient = await createSessionClient({ admin: true });
  if (!sessionClient) return errorResponse("Supabase is not configured.", 503);
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return errorResponse("Sign in with an administrator account.", 401);
  if (user.app_metadata?.role !== "admin") return errorResponse("Administrator access is required.", 403);
  const service = createServiceClient();
  if (!service) return errorResponse("The server Supabase service key is not configured.", 503);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorResponse("Invalid request body.", 400); }
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const statuses = ["new", "reviewing", "quoted", "completed", "declined", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.includes(status)) return errorResponse("Choose a valid custom request and status.", 400);
  const quote = body.quoted_price_bdt == null || body.quoted_price_bdt === "" ? null : Number(body.quoted_price_bdt);
  if (quote !== null && (!Number.isFinite(quote) || quote < 0 || quote > 100000000)) return errorResponse("Enter a valid quote amount in BDT.", 400);
  const note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 4000) || null : null;
  const { data, error } = await service.rpc("admin_change_custom_request_status", {
    p_request_id: id, p_status: status, p_actor_user_id: user.id,
    p_actor_email: user.email ?? "Admin", p_note: note, p_quoted_price_bdt: quote,
  });
  if (error?.code === "P0002") return errorResponse(error.message, 404);
  if (error?.code === "22023") return errorResponse(error.message, 409);
  if (error) return errorResponse("The custom request status could not be updated. Apply the latest Supabase migration and try again.", 500);
  return NextResponse.json({ ok: true, request: data });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return errorResponse("Request origin could not be verified.", 403);
    } catch {
      return errorResponse("Request origin could not be verified.", 403);
    }
  }

  const supabase = createServiceClient();
  if (!supabase) return errorResponse("Custom request submissions are not connected yet. Configure Supabase and the server service key.", 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Please submit the request form again.", 400);
  }

  // Quietly accept automated honeypot submissions without storing them.
  if (String(form.get("website") ?? "").trim()) return NextResponse.json({ success: true });

  const fullName = String(form.get("fullName") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const cityArea = String(form.get("cityArea") ?? "").trim();
  const deliveryAddress = String(form.get("deliveryAddress") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const files = form.getAll("photos").filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0);

  if (fullName.length < 2 || fullName.length > 120) return errorResponse("Enter your full name.", 400);
  if (!/^[+\d][\d\s().-]{6,18}$/.test(phone)) return errorResponse("Enter a valid phone number.", 400);
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return errorResponse("Enter a valid email address.", 400);
  if (cityArea.length < 2 || cityArea.length > 120) return errorResponse("Enter your city or area.", 400);
  if (deliveryAddress.length < 5 || deliveryAddress.length > 600) return errorResponse("Enter your delivery address.", 400);
  if (description.length < 10 || description.length > 5000) return errorResponse("Describe the custom piece (10 to 5,000 characters).", 400);
  if (files.length > 4) return errorResponse("You can attach up to four reference photos.", 400);
  if (files.some((file) => !acceptedTypes.has(file.type) || file.size > maxPhotoBytes)) return errorResponse("Photos must be JPG, PNG, or WEBP and no larger than 5 MB each.", 400);

  let customerId: string | null = null;
  const sessionClient = await createSessionClient();
  if (sessionClient) {
    const { data: { user } } = await sessionClient.auth.getUser();
    customerId = user?.id ?? null;
    if (user) {
      const profile: { id: string; full_name?: string } = { id: user.id };
      if (typeof user.user_metadata.full_name === "string") profile.full_name = user.user_metadata.full_name;
      const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
      if (profileError) return errorResponse("We could not verify your customer details. Please try again.", 500);
    }
  }

  const { data: savedRequest, error: saveError } = await supabase
    .from("custom_requests")
    .insert({
      customer_id: customerId,
      full_name: fullName,
      phone,
      email: email || null,
      city_area: cityArea,
      delivery_address: deliveryAddress,
      description,
    })
    .select("id, request_number")
    .single();

  if (saveError || !savedRequest) return errorResponse("We could not save your request. Please try again shortly.", 500);

  const uploadedPaths: string[] = [];
  const imageRows: { request_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; sort_order: number }[] = [];
  for (const [index, file] of files.entries()) {
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || `reference-${index + 1}`;
    const path = `${savedRequest.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      if (uploadedPaths.length) await supabase.storage.from(bucket).remove(uploadedPaths);
      await supabase.from("custom_requests").delete().eq("id", savedRequest.id);
      return errorResponse("A reference photo could not be uploaded. Please try again.", 500);
    }
    uploadedPaths.push(path);
    imageRows.push({ request_id: savedRequest.id, storage_path: path, file_name: file.name.slice(0, 180), mime_type: file.type, size_bytes: file.size, sort_order: index });
  }

  if (imageRows.length) {
    const { error: imageError } = await supabase.from("custom_request_images").insert(imageRows);
    if (imageError) {
      await supabase.storage.from(bucket).remove(uploadedPaths);
      await supabase.from("custom_requests").delete().eq("id", savedRequest.id);
      return errorResponse("We could not save the reference photos. Please try again.", 500);
    }
  }

  return NextResponse.json({ success: true, requestNumber: savedRequest.request_number }, { status: 201 });
}
