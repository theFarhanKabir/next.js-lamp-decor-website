import { createServer } from "node:http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { config, hasSupabaseAdmin, hasSupabaseAuth } from "./config.mjs";
import { uploadOptimizedImage, optimizeImage } from "./images.mjs";
import { getPublicClient, getServiceClient, requireAdmin, requireUser, verifyAccessToken } from "./supabase.mjs";
import { HttpError, imageHttpUrl, money, objectBody, slugify, text } from "./validation.mjs";

const requestWindows = new Map();
const processedSmsHookIds = new Map();
const orderStatuses = new Set(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);
const saleStatuses = ["confirmed", "processing", "shipped", "delivered"];

function send(response, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(payload);
}

async function readBytes(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "The request is larger than the allowed upload size.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

async function readJson(request) {
  const type = request.headers["content-type"] ?? "";
  if (!type.toLowerCase().includes("application/json")) throw new HttpError(415, "Send this request as JSON.");
  let parsed;
  try { parsed = JSON.parse((await readBytes(request, config.maxJsonBytes)).toString("utf8")); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "The JSON body could not be read.");
  }
  return objectBody(parsed);
}

function verifySendSmsHookSignature(request, rawPayload) {
  const hookId = request.headers["webhook-id"];
  const timestampHeader = request.headers["webhook-timestamp"];
  const signatureHeader = request.headers["webhook-signature"];
  const timestamp = typeof timestampHeader === "string" ? Number(timestampHeader) : NaN;
  if (typeof hookId !== "string" || !hookId || hookId.length > 200
      || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 5 * 60_000
      || typeof signatureHeader !== "string") {
    throw new HttpError(401, "The Supabase SMS hook signature is invalid or expired.");
  }

  const secrets = config.supabaseSendSmsHookSecrets.split("|").map((entry) => entry.trim()).filter(Boolean);
  const keys = secrets.flatMap((secret) => {
    const match = /^v1,whsec_([A-Za-z0-9+/]+={0,2})$/.exec(secret);
    if (!match) return [];
    const key = Buffer.from(match[1], "base64");
    return key.length >= 16 ? [key] : [];
  });
  if (!keys.length) throw new HttpError(503, "The Supabase SMS hook is not configured on this server.");

  const signedContent = `${hookId}.${timestampHeader}.${rawPayload}`;
  const candidates = signatureHeader.trim().split(/\s+/).flatMap((entry) => {
    const match = /^v1,([A-Za-z0-9+/]+={0,2})$/.exec(entry);
    if (!match) return [];
    return [Buffer.from(match[1], "base64")];
  });
  const valid = keys.some((key) => candidates.some((candidate) => {
    const expected = createHmac("sha256", key).update(signedContent, "utf8").digest();
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }));
  if (!valid) throw new HttpError(401, "The Supabase SMS hook signature is invalid.");
  return hookId;
}

async function handleSupabaseSendSmsHook(request, response) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("application/json")) throw new HttpError(415, "Send this hook as JSON.");
  const rawPayload = (await readBytes(request, 32 * 1024)).toString("utf8");
  const hookId = verifySendSmsHookSignature(request, rawPayload);
  if (processedSmsHookIds.has(hookId)) { response.writeHead(200, { "Cache-Control": "no-store" }); response.end(); return; }

  let event;
  try { event = JSON.parse(rawPayload); }
  catch { throw new HttpError(400, "The Supabase SMS hook payload is not valid JSON."); }
  const phone = typeof event?.user?.phone === "string" ? event.user.phone : "";
  const mobileNumber = phone.replace(/\D/g, "");
  const otp = typeof event?.sms?.otp === "string" ? event.sms.otp : String(event?.sms?.otp ?? "");
  if (!/^8801[3-9]\d{8}$/.test(mobileNumber) || !/^\d{6}$/.test(otp)) {
    throw new HttpError(400, "The SMS hook requires a Bangladesh mobile number and a 6-digit OTP.");
  }
  if (!config.mimsmsUserName || !config.mimsmsApiKey || !config.mimsmsSenderName) {
    throw new HttpError(503, "MiMSMS credentials and a Sender ID are not configured on this server.");
  }

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.mimsms.com/api/V2/SMS", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        apiKey: config.mimsmsApiKey,
        userName: config.mimsmsUserName,
        senderName: config.mimsmsSenderName,
        campaignName: "CloudLamps OTP",
        transactionType: "T",
        mobileNumber,
        message: `Your Cloud Lamps & Mirrors verification code is ${otp}. Do not share this code with anyone.`,
      }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    throw new HttpError(502, "MiMSMS could not be reached to deliver the verification code.");
  }
  const result = await providerResponse.json().catch(() => null);
  if (!providerResponse.ok || !result || String(result.statusCode) !== "200"
      || String(result.status).toLowerCase() !== "success") {
    console.error("MiMSMS rejected an authentication SMS:", String(result?.statusCode ?? providerResponse.status));
    throw new HttpError(502, "MiMSMS could not send the verification code. Check the API key, IP/domain whitelist, and Sender ID.");
  }

  const now = Date.now();
  for (const [id, createdAt] of processedSmsHookIds) if (now - createdAt > 10 * 60_000) processedSmsHookIds.delete(id);
  processedSmsHookIds.set(hookId, now);
  while (processedSmsHookIds.size > 5000) processedSmsHookIds.delete(processedSmsHookIds.keys().next().value);
  response.writeHead(200, { "Cache-Control": "no-store" });
  response.end();
}

function getPublicDb() {
  const client = getPublicClient();
  if (!client) throw new HttpError(503, "Supabase is not connected. Configure the backend environment when you are ready to connect it.");
  return client;
}

function getAdminDb() {
  const client = getServiceClient();
  if (!client) throw new HttpError(503, "Supabase admin access is not connected. Configure the server-only key when you are ready.");
  return client;
}

function assertNoDbError(error, message = "The data request could not be completed.") {
  if (error) {
    console.error("Supabase operation failed:", error.code ?? "unknown", error.message ?? "unknown error");
    throw new HttpError(502, message);
  }
}

async function admin(request) {
  const result = await requireAdmin(request);
  if (result.error) throw new HttpError(result.error.status, result.error.message);
  return result;
}

async function customer(request) {
  const result = await requireUser(request);
  if (result.error) throw new HttpError(result.error.status, result.error.message);
  return result;
}

function normalizeCartOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const options = {};
  for (const key of ["size", "color", "fabric", "legFinish"]) {
    const option = value[key];
    if (option == null || option === "") continue;
    options[key] = text(option, `Selected ${key}`, { min: 1, max: 80 });
  }
  return options;
}

async function handleCustomerState(request, response, method) {
  const auth = await customer(request);
  if (method === "GET") {
    const { data, error } = await auth.client.from("customer_storefront_state")
      .select("cart_items,wishlist_product_ids").eq("customer_id", auth.user.id).maybeSingle();
    assertNoDbError(error, "Your saved cart and wishlist could not be loaded.");
    send(response, 200, {
      cartItems: Array.isArray(data?.cart_items) ? data.cart_items : [],
      wishlistProductIds: Array.isArray(data?.wishlist_product_ids) ? data.wishlist_product_ids : [],
    });
    return;
  }
  if (method !== "PUT") throw new HttpError(405, "This method is not supported for customer state.");
  const body = await readJson(request);
  if (!Array.isArray(body.cartItems) || body.cartItems.length > 100
      || !Array.isArray(body.wishlistProductIds) || body.wishlistProductIds.length > 300) {
    throw new HttpError(400, "The saved cart or wishlist is too large or invalid.");
  }
  const cartByKey = new Map();
  for (const item of body.cartItems) {
    const productId = text(item?.productId, "Product", { min: 1, max: 120 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId)) throw new HttpError(400, "A saved product is invalid.");
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new HttpError(400, "A saved quantity is invalid.");
    const options = normalizeCartOptions(item?.options);
    const key = `${productId}:${JSON.stringify(options)}`;
    const existing = cartByKey.get(key);
    const mergedQuantity = (existing?.quantity ?? 0) + quantity;
    if (mergedQuantity > 50) throw new HttpError(400, "A saved product quantity cannot exceed 50.");
    cartByKey.set(key, { productId, quantity: mergedQuantity, options });
  }
  const wishlist = [...new Set(body.wishlistProductIds.map((id) => {
    const slug = text(id, "Wishlist product", { min: 1, max: 120 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, "A wishlist product is invalid.");
    return slug;
  }))];
  const cartItems = [...cartByKey.values()];
  const slugs = [...new Set([...cartItems.map((item) => item.productId), ...wishlist])];
  if (slugs.length) {
    const { data: products, error } = await auth.client.from("products").select("slug")
      .eq("status", "active").in("slug", slugs);
    assertNoDbError(error, "Saved products could not be checked.");
    const active = new Set((products ?? []).map((product) => product.slug));
    if (slugs.some((slug) => !active.has(slug))) throw new HttpError(400, "Remove unavailable products before saving your cart or wishlist.");
  }
  const { error } = await auth.client.from("customer_storefront_state").upsert({
    customer_id: auth.user.id,
    cart_items: cartItems,
    wishlist_product_ids: wishlist,
    updated_at: new Date().toISOString(),
  }, { onConflict: "customer_id" });
  assertNoDbError(error, "Your cart and wishlist could not be saved.");
  send(response, 200, { ok: true, cartItems, wishlistProductIds: wishlist });
}

async function handleCustomerRewards(request, response) {
  const auth = await customer(request);
  const [account, settings] = await Promise.all([
    auth.client.from("reward_accounts").select("points_balance,points_debt").eq("customer_id", auth.user.id).maybeSingle(),
    auth.client.from("store_settings").select("value").eq("key", "rewards").maybeSingle(),
  ]);
  assertNoDbError(account.error ?? settings.error, "Your reward balance could not be loaded.");
  const config = settings.data?.value ?? {};
  const balance = Number(account.data?.points_balance ?? 0);
  const debt = Number(account.data?.points_debt ?? 0);
  send(response, 200, {
    pointsBalance: Math.max(0, balance - debt),
    settings: {
      enabled: config.enabled === true,
      redemptionPoints: Number.isInteger(config.redemption_points) ? config.redemption_points : 100,
      redemptionValueBdt: Number.isFinite(Number(config.redemption_value_bdt)) ? Number(config.redemption_value_bdt) : 0,
    },
  });
}

async function handleCouponValidation(request, response) {
  const body = await readJson(request);
  const code = text(body.code, "Coupon code", { min: 1, max: 64 }).trim().toUpperCase();
  const subtotal = money(body.subtotalBdt, "Subtotal");
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code) || subtotal <= 0) throw new HttpError(400, "Enter a valid coupon and cart subtotal.");
  const service = getAdminDb();
  const { data: coupon, error } = await service.from("coupons").select("code,description,discount_type,discount_value,minimum_order_bdt,usage_limit,usage_count,starts_at,ends_at,is_active")
    .eq("code", code).maybeSingle();
  assertNoDbError(error, "The coupon could not be checked.");
  const now = Date.now();
  if (!coupon || !coupon.is_active) throw new HttpError(400, "This coupon is not available.");
  if (coupon.starts_at && Date.parse(coupon.starts_at) > now) throw new HttpError(400, "This coupon is not active yet.");
  if (coupon.ends_at && Date.parse(coupon.ends_at) <= now) throw new HttpError(400, "This coupon has expired.");
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) throw new HttpError(400, "This coupon has reached its usage limit.");
  if (subtotal < Number(coupon.minimum_order_bdt)) throw new HttpError(400, `This coupon requires a minimum order of BDT ${Number(coupon.minimum_order_bdt).toFixed(2)}.`);
  const discount = coupon.discount_type === "percentage"
    ? Math.min(subtotal, Math.round(subtotal * Number(coupon.discount_value)) / 100)
    : Math.min(subtotal, Number(coupon.discount_value));
  send(response, 200, { code: coupon.code, description: coupon.description, discountBdt: money(discount) });
}

function productView(row) {
  const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const primary = images.find((image) => image.image_role === "product") ?? images[0];
  const lifestyle = images.find((image) => image.image_role === "lifestyle") ?? images[1] ?? primary;
  const attrs = row.attributes ?? {};
  const publicPrice = Number(row.price_bdt);
  const comparePrice = row.compare_at_price_bdt == null ? null : Number(row.compare_at_price_bdt);
  const responsiveSet = (image) => (Array.isArray(image?.image_variants) ? image.image_variants : [])
    .filter((variant) => Number.isInteger(variant?.width) && variant.width > 0 && typeof variant.url === "string")
    .map((variant) => `${variant.url} ${variant.width}w`).join(", ") || undefined;
  return {
    id: row.slug,
    name: row.name,
    category: row.category?.name === "Lamps" ? "Lighting" : row.category?.name ?? "Lighting",
    categorySlug: row.category?.slug,
    subcategory: row.subcategory?.name ?? row.category?.name ?? "",
    subcategorySlug: row.subcategory?.slug,
    description: row.description || row.short_description || "",
    badge: comparePrice ? "sale" : attrs.special_edition ? "new" : attrs.badge,
    basePrice: Math.round((comparePrice ?? publicPrice) * 100),
    salePrice: comparePrice ? Math.round(publicPrice * 100) : undefined,
    rating: attrs.rating,
    reviewCount: attrs.reviewCount,
    swatches: row.swatches ?? [],
    images: { silo: primary?.public_url ?? attrs.imageUrl ?? "", lifestyle: lifestyle?.public_url ?? primary?.public_url ?? "", siloSrcSet: responsiveSet(primary), lifestyleSrcSet: responsiveSet(lifestyle) },
    gallery: images.map((image) => image.public_url),
    galleryDetails: images.map((image) => ({ url: image.public_url, alt: image.alt_text ?? row.name, role: image.image_role, variants: image.image_variants ?? [] })),
    imageVariants: Object.fromEntries(images.map((image) => [image.public_url, Array.isArray(image.image_variants) ? image.image_variants : []])),
    sizes: (attrs.sizes ?? []).map((option) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
    fabrics: (attrs.fabrics ?? []).map((option) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
    legs: (attrs.legs ?? []).map((option) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
    materials: attrs.materials ?? [],
    dimensions: attrs.dimensions ?? {},
    sizeDimensions: attrs.sizeDimensions ?? {},
    materialDetails: attrs.materialDetails ?? {},
    orderType: row.made_to_order ? "made-to-order" : "in-stock",
    leadTime: row.lead_time ?? undefined,
  };
}

async function getProductRows(client, { slug, activeOnly = false } = {}) {
  let query = client.from("products")
    .select("id,category_id,subcategory_id,name,slug,short_description,description,price_bdt,compare_at_price_bdt,status,made_to_order,lead_time,attributes,swatches,sort_order,category:categories!products_category_id_fkey(name,slug),subcategory:categories!products_subcategory_id_category_id_fkey(name,slug),product_images(public_url,alt_text,image_role,sort_order)")
    .order("sort_order", { ascending: true });
  if (slug) query = query.eq("slug", slug);
  if (activeOnly) query = query.eq("status", "active");
  const { data, error } = await query;
  assertNoDbError(error, "The product catalogue could not be loaded. Apply the backend migrations and try again.");
  return data ?? [];
}

async function handleCatalog(response) {
  const db = getPublicDb();
  const [products, { data: categoryRows, error: categoryError }] = await Promise.all([
    getProductRows(db, { activeOnly: true }),
    db.from("categories").select("id,name,slug,parent_id,is_active").eq("is_active", true).order("sort_order"),
  ]);
  if (categoryError) console.error("Supabase category query failed:", categoryError.code ?? "unknown", categoryError.message ?? "unknown error");
  const rows = categoryRows ?? [];
  const parents = new Map(rows.filter((row) => !row.parent_id).map((row) => [row.id, row]));
  const categories = categoryError ? [] : rows.filter((row) => row.parent_id).map((row) => ({
    name: row.name,
    slug: row.slug,
    parentSlug: parents.get(row.parent_id)?.slug ?? "",
    parentName: parents.get(row.parent_id)?.name ?? "",
  }));
  send(response, 200, { products: products.map(productView), categories, source: "supabase" }, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
}

function validImageVariants(variants) {
  if (variants == null) return true;
  return Array.isArray(variants) && variants.length <= 3 && variants.every((variant) => variant && Number.isInteger(variant.width) && variant.width > 0 && variant.width <= 1600 && Number.isInteger(variant.height) && variant.height > 0 && variant.height <= 1600 && imageHttpUrl(variant.url) && typeof variant.storagePath === "string" && variant.storagePath.length <= 500);
}

function validateHomepage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Homepage content must be an object.");
  const { heroSlides, categories, hotDeals } = value;
  if (!Array.isArray(heroSlides) || heroSlides.length < 1 || heroSlides.length > 10) throw new HttpError(400, "Add between 1 and 10 hero slides.");
  if (!Array.isArray(categories) || categories.length < 1 || categories.length > 12) throw new HttpError(400, "Add between 1 and 12 homepage categories.");
  if (!Array.isArray(hotDeals) || hotDeals.length > 30) throw new HttpError(400, "A maximum of 30 hot deals is supported.");
  const validText = (value, max) => typeof value === "string" && value.length <= max;
  for (const slide of heroSlides) {
    if (!imageHttpUrl(slide?.image) || !validText(slide.alt, 250) || !validText(slide.eyebrow, 100) || !validText(slide.headline, 180) || !validText(slide.subtext, 400) || !validText(slide.ctaLabel, 80) || !validText(slide.categorySlug, 80) || typeof slide.active !== "boolean" || !validImageVariants(slide.imageVariants)) throw new HttpError(400, "A hero slide contains invalid text, link, or image data.");
  }
  for (const category of categories) {
    if (!imageHttpUrl(category?.image) || !validText(category.alt, 250) || !validText(category.name, 80) || !category.name || !validText(category.slug, 80) || typeof category.active !== "boolean" || !validImageVariants(category.imageVariants)) throw new HttpError(400, "A homepage category contains invalid data.");
  }
  for (const deal of hotDeals) {
    if (!imageHttpUrl(deal?.image) || !validText(deal.alt, 250) || !validText(deal.productId, 120) || !validText(deal.name, 120) || !validText(deal.category, 80) || !Number.isFinite(deal.price) || deal.price < 0 || !Number.isFinite(deal.was) || deal.was < deal.price || typeof deal.active !== "boolean" || !validImageVariants(deal.imageVariants)) throw new HttpError(400, "A hot deal contains invalid prices, copy, or image data.");
  }
}

async function saveProductImageRows(service, productId, images, productName) {
  if (!Array.isArray(images) || images.length > 30) throw new HttpError(400, "A product can have at most 30 gallery images.");
  const rows = images.map((image, index) => {
    if (!image || !imageHttpUrl(image.url)) throw new HttpError(400, "Product images must use valid HTTP or HTTPS URLs.");
    const variants = Array.isArray(image.variants) ? image.variants : Array.isArray(image.image_variants) ? image.image_variants : [];
    if (variants.length > 3 || variants.some((variant) => !variant || !Number.isInteger(variant.width) || variant.width < 1 || variant.width > 1600 || !Number.isInteger(variant.height) || variant.height < 1 || variant.height > 1600 || !imageHttpUrl(variant.url) || typeof variant.storagePath !== "string" || variant.storagePath.length > 500)) {
      throw new HttpError(400, "A product image has an invalid responsive image manifest.");
    }
    return {
      product_id: productId,
      public_url: image.url,
      storage_path: typeof image.storagePath === "string" ? image.storagePath : typeof image.storage_path === "string" ? image.storage_path : null,
      image_variants: variants,
      alt_text: String(image.alt ?? productName).slice(0, 250),
      image_role: image.role === "lifestyle" ? "lifestyle" : "product",
      sort_order: index,
    };
  });
  const { error: removeError } = await service.from("product_images").delete().eq("product_id", productId);
  assertNoDbError(removeError, "The old product image list could not be updated.");
  if (rows.length) {
    const { error } = await service.from("product_images").insert(rows);
    assertNoDbError(error, "The product was saved, but its image list could not be saved.");
  }
}

async function saveProduct(service, body) {
  const name = text(body.name, "Product name", { min: 2, max: 160 });
  const slug = slugify(text(body.slug || name, "URL slug", { min: 1, max: 180 }));
  if (!slug) throw new HttpError(400, "Enter a valid product URL slug.");
  const categorySlug = text(body.category_slug, "Department", { min: 1, max: 80 });
  const price = money(body.price_bdt, "Selling price");
  const cost = body.cost_price_bdt === "" || body.cost_price_bdt == null ? null : money(body.cost_price_bdt, "Unit cost");
  const compare = body.compare_at_price_bdt === "" || body.compare_at_price_bdt == null ? null : money(body.compare_at_price_bdt, "Original price");
  if (compare != null && compare < price) throw new HttpError(400, "Original price must be at least the selling price.");
  const { data: category, error: categoryError } = await service.from("categories").select("id,parent_id").eq("slug", categorySlug).single();
  assertNoDbError(categoryError, "Choose one of the store's departments.");
  const parentId = category.parent_id ?? category.id;
  const subcategoryName = text(body.subcategory_name ?? "", "Subcategory", { max: 80, optional: true });
  let subcategoryId = null;
  if (subcategoryName) {
    const subcategorySlug = slugify(subcategoryName);
    if (!subcategorySlug) throw new HttpError(400, "Enter a valid subcategory name.");
    const { data: existing, error } = await service.from("categories").select("id").eq("parent_id", parentId).eq("slug", subcategorySlug).maybeSingle();
    assertNoDbError(error, "The subcategory could not be checked.");
    if (existing) subcategoryId = existing.id;
    else {
      const { data: created, error: createError } = await service.from("categories")
        .insert({ parent_id: parentId, name: subcategoryName, slug: subcategorySlug, is_fixed: false, is_active: true })
        .select("id").single();
      assertNoDbError(createError, "The subcategory could not be saved.");
      subcategoryId = created.id;
    }
  }
  const inventory = Number(body.inventory_quantity ?? 0);
  if (!Number.isInteger(inventory) || inventory < 0) throw new HttpError(400, "Stock quantity must be a non-negative whole number.");
  const swatches = Array.isArray(body.swatches) ? body.swatches : [];
  if (swatches.length > 30 || swatches.some((swatch) => !swatch || typeof swatch.label !== "string" || swatch.label.length > 80 || typeof swatch.color !== "string" || !/^#[0-9a-f]{6}$/i.test(swatch.color))) {
    throw new HttpError(400, "Check the colour finish names and swatch colours.");
  }
  if (swatches.some((swatch) => (swatch.imageUrl && !imageHttpUrl(swatch.imageUrl)) || !validImageVariants(swatch.imageVariants))) throw new HttpError(400, "A colour finish has an invalid image URL or responsive image manifest.");
  const record = {
    name, slug, sku: text(body.sku ?? "", "SKU", { max: 80, optional: true }) || null,
    category_id: parentId, subcategory_id: subcategoryId,
    short_description: text(body.short_description ?? "", "Short description", { max: 400, optional: true }) || null,
    description: text(body.description ?? "", "Description", { max: 10_000, optional: true }),
    price_bdt: price, cost_price_bdt: cost, compare_at_price_bdt: compare,
    inventory_quantity: inventory, track_inventory: body.track_inventory !== false,
    status: body.status === "active" ? "active" : body.status === "archived" ? "archived" : "draft",
    made_to_order: Boolean(body.made_to_order), lead_time: text(body.lead_time ?? "", "Lead time", { max: 80, optional: true }) || null,
    attributes: body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes) ? body.attributes : {}, swatches,
    is_featured: Boolean(body.is_featured),
    published_at: body.status === "active" ? new Date().toISOString() : null,
  };
  const { data, error } = await service.from("products").upsert(record, { onConflict: "slug" }).select("id,slug").single();
  assertNoDbError(error, "The product could not be saved.");
  await saveProductImageRows(service, data.id, body.images ?? [], name);
  return data;
}

function productStoragePath(image) {
  if (typeof image.storage_path === "string" && image.storage_path.startsWith("products/")) return image.storage_path;
  try {
    const pathname = new URL(image.public_url).pathname;
    const marker = "/storage/v1/object/public/store-media/";
    const index = pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(pathname.slice(index + marker.length));
    return path.startsWith("products/") ? path : null;
  } catch { return null; }
}

async function handleAdminProducts(request, response, method, url) {
  const auth = await admin(request);
  if (method === "GET") {
    const { data, error } = await auth.service.from("products")
      .select("*, category:categories!products_category_id_fkey(name,slug), subcategory:categories!products_subcategory_id_category_id_fkey(name,slug), product_images(*)")
      .order("updated_at", { ascending: false });
    assertNoDbError(error, "Could not load products. Apply the database migrations and try again.");
    send(response, 200, { products: data ?? [] });
    return;
  }
  const body = await readJson(request);
  if (method === "POST") {
    const product = await saveProduct(auth.service, body);
    send(response, 201, { product });
    return;
  }
  if (method === "PATCH") {
    const slug = text(body.slug, "Product slug", { min: 1, max: 180 });
    if (!["draft", "active", "archived"].includes(body.status)) throw new HttpError(400, "Choose a valid product status.");
    const { error } = await auth.service.from("products").update({ status: body.status, published_at: body.status === "active" ? new Date().toISOString() : null }).eq("slug", slug);
    assertNoDbError(error, "The product status could not be updated.");
    send(response, 200, { ok: true });
    return;
  }
  if (method === "DELETE") {
    const slug = text(body.slug, "Product slug", { min: 1, max: 180 });
    const { data: product, error: lookupError } = await auth.service.from("products")
      .select("id,slug").eq("slug", slug).maybeSingle();
    assertNoDbError(lookupError, "Could not load the product.");
    if (!product) throw new HttpError(404, "Product not found.");

    const [{ count: orderCount, error: orderError }, { count: reviewCount, error: reviewError }, { data: images, error: imageError }, { data: homepage, error: homepageError }] = await Promise.all([
      auth.service.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", product.id),
      auth.service.from("reviews").select("id", { count: "exact", head: true }).eq("product_id", product.id),
      auth.service.from("product_images").select("public_url,storage_path").eq("product_id", product.id),
      auth.service.from("store_settings").select("value").eq("key", "homepage_content").maybeSingle(),
    ]);
    assertNoDbError(orderError ?? reviewError ?? imageError ?? homepageError, "The product's related records could not be checked.");
    if (orderCount || reviewCount) throw new HttpError(409, "This product has order or review history. Archive it instead to preserve those records.");

    const content = homepage?.value;
    const arrivals = content?.newArrivals?.productIds ?? content?.newArrivals;
    const usedInHomepage = (Array.isArray(arrivals) && arrivals.includes(product.slug))
      || (Array.isArray(content?.hotDeals) && content.hotDeals.some((deal) => deal?.productId === product.slug));
    if (usedInHomepage) throw new HttpError(409, "Remove this product from New Arrivals and Hot Deals before deleting it.");

    const imageUrls = [...new Set((images ?? []).map((image) => image.public_url))];
    const { data: sharedImages, error: sharedImageError } = imageUrls.length
      ? await auth.service.from("product_images").select("public_url").in("public_url", imageUrls).neq("product_id", product.id)
      : { data: [], error: null };
    assertNoDbError(sharedImageError, "The product images could not be checked for shared use.");
    const sharedUrls = new Set((sharedImages ?? []).map((image) => image.public_url));
    const homepageValue = JSON.stringify(content ?? null);
    const storagePaths = [...new Set((images ?? [])
      .filter((image) => !sharedUrls.has(image.public_url) && !homepageValue.includes(image.public_url))
      .map(productStoragePath)
      .filter(Boolean))];

    const { error: deleteError } = await auth.service.from("products").delete().eq("id", product.id);
    if (deleteError?.code === "23503") throw new HttpError(409, "This product is still referenced by store records. Archive it instead.");
    assertNoDbError(deleteError, "The product could not be deleted.");
    const { error: storageError } = storagePaths.length
      ? await auth.service.storage.from(config.storeMediaBucket).remove(storagePaths)
      : { error: null };
    send(response, 200, { ok: true, slug: product.slug, ...(storageError ? { warning: "The product was deleted, but one or more uploaded images could not be removed from Storage." } : {}) });
    return;
  }
  throw new HttpError(405, "This method is not supported for products.");
}

async function handleCategories(request, response, method) {
  const auth = await admin(request);
  if (method === "GET") {
    const { data, error } = await auth.service.from("categories")
      .select("id,name,slug,parent_id,is_fixed,is_active,sort_order")
      .order("sort_order");
    assertNoDbError(error, "Could not load categories.");
    send(response, 200, { categories: data ?? [] });
    return;
  }

  const body = await readJson(request);
  if (method === "PATCH") {
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > 80) throw new HttpError(400, "A subcategory and a name up to 80 characters are required.");
    const { data: category, error: lookupError } = await auth.service.from("categories")
      .select("id,parent_id,is_fixed").eq("id", id).maybeSingle();
    assertNoDbError(lookupError, "Could not load this category.");
    if (!category || !category.parent_id || category.is_fixed) throw new HttpError(400, "Only subcategories can be renamed.");
    const { data: duplicate, error: duplicateError } = await auth.service.from("categories")
      .select("id").eq("parent_id", category.parent_id).ilike("name", name).neq("id", id).maybeSingle();
    assertNoDbError(duplicateError, "Could not check for duplicate category names.");
    if (duplicate) throw new HttpError(409, "A subcategory with that name already exists in this department.");
    const { data, error } = await auth.service.from("categories").update({ name })
      .eq("id", id).select("id,name,slug,parent_id,is_fixed,is_active,sort_order").single();
    assertNoDbError(error, "The category could not be renamed.");
    send(response, 200, { category: data });
    return;
  }

  if (method === "POST") {
    const parentId = typeof body.parentId === "string" ? body.parentId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = slugify(name);
    if (!/^[0-9a-f-]{36}$/i.test(parentId) || !name || name.length > 80 || !slug) {
      throw new HttpError(400, "Choose a department and enter a valid subcategory name.");
    }
    const { data: parent, error: parentError } = await auth.service.from("categories")
      .select("id,parent_id,is_fixed").eq("id", parentId).maybeSingle();
    assertNoDbError(parentError, "Could not load the selected department.");
    if (!parent || parent.parent_id || !parent.is_fixed) throw new HttpError(400, "Choose one of the fixed store departments.");
    const { data: category, error } = await auth.service.from("categories")
      .insert({ parent_id: parentId, name, slug, is_fixed: false, is_active: true, sort_order: 999 })
      .select("id,name,slug,parent_id,is_fixed,is_active,sort_order").single();
    if (error?.code === "23505") throw new HttpError(409, "A category with this name or URL already exists.");
    assertNoDbError(error, "The subcategory could not be added.");
    send(response, 201, { category });
    return;
  }
  if (method === "DELETE") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "A valid subcategory is required.");
    const { data: category, error: lookupError } = await auth.service.from("categories")
      .select("id,parent_id,is_fixed").eq("id", id).maybeSingle();
    assertNoDbError(lookupError, "Could not load this category.");
    if (!category || !category.parent_id || category.is_fixed) throw new HttpError(400, "Only subcategories can be removed. Main departments are protected.");
    const { count, error: productError } = await auth.service.from("products")
      .select("id", { count: "exact", head: true }).eq("subcategory_id", id);
    assertNoDbError(productError, "Could not check whether products use this subcategory.");
    if (count) throw new HttpError(409, `This subcategory is assigned to ${count} product${count === 1 ? "" : "s"}. Reassign those products before removing it.`);
    const { error: deleteError } = await auth.service.from("categories").delete().eq("id", id);
    if (deleteError?.code === "23503") throw new HttpError(409, "This subcategory is still in use. Reassign its products before removing it.");
    assertNoDbError(deleteError, "The subcategory could not be removed.");
    send(response, 200, { ok: true, id });
    return;
  }
  throw new HttpError(405, "This method is not supported for categories.");
}

async function handleImageUpload(request, response) {
  const auth = await admin(request);
  const contentType = String(request.headers["content-type"] ?? "").split(";")[0].toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(contentType)) throw new HttpError(415, "Upload a JPG, PNG, WebP, or AVIF image.");
  const input = await readBytes(request, config.maxImageBytes);
  const role = String(request.headers["x-image-role"] ?? "product");
  if (!["product", "color", "hero", "category", "deal"].includes(role)) throw new HttpError(400, "Choose a product, colour, hero, category, or deal image role.");
  const slug = slugify(String(request.headers["x-product-slug"] ?? "new-product")) || "new-product";
  const folder = ["hero", "category", "deal"].includes(role) ? `homepage/${role}` : `products/${slug}`;
  const image = await uploadOptimizedImage(auth.service, { input, folder });
  send(response, 201, { image: { ...image, role, alt: String(request.headers["x-image-alt"] ?? "").slice(0, 250) } });
}

async function handleHomepage(response, method, request, isAdminRoute) {
  if (isAdminRoute) {
    const auth = await admin(request);
    if (method === "GET") {
      const { data, error } = await auth.service.from("store_settings").select("value").eq("key", "homepage_content").maybeSingle();
      assertNoDbError(error, "Could not load homepage content.");
  send(response, 200, { content: data?.value ?? null, source: data?.value ? "supabase" : "unset" }, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
      return;
    }
    const body = await readJson(request);
    validateHomepage(body.content);
    const { error } = await auth.service.from("store_settings").upsert({ key: "homepage_content", value: body.content }, { onConflict: "key" });
    assertNoDbError(error, "Homepage content could not be saved.");
    send(response, 200, { ok: true });
    return;
  }
  const { data, error } = await getPublicDb().from("store_settings").select("value").eq("key", "homepage_content").maybeSingle();
  assertNoDbError(error, "Homepage content could not be loaded.");
  send(response, 200, { content: data?.value ?? null, source: data?.value ? "supabase" : "unset" }, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
}

async function handleReviews(request, response, method, url) {
  if (method === "GET" && url.searchParams.get("admin") === "1") {
    const auth = await admin(request);
    const { data, error } = await auth.service.from("reviews")
      .select("id,product_slug,customer_name,rating,title,body,status,created_at,admin_reply")
      .order("created_at", { ascending: false });
    assertNoDbError(error, "Could not load customer reviews.");
    send(response, 200, { reviews: data ?? [] });
    return;
  }
  if (method === "GET") {
    const slug = text(url.searchParams.get("product") ?? "", "Product slug", { min: 1, max: 120 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, "Choose a valid product.");
    const db = getPublicDb();
    const { data: product, error: productError } = await db.from("products")
      .select("id").eq("slug", slug).eq("status", "active").maybeSingle();
    assertNoDbError(productError, "Could not verify this product.");
    if (!product) throw new HttpError(404, "This product is not available for reviews.");
    const { data, error } = await db.from("reviews")
      .select("id,product_slug,customer_name,rating,title,body,created_at")
      .eq("product_slug", slug).eq("status", "published").order("created_at", { ascending: false });
    assertNoDbError(error, "Could not load product reviews.");
    send(response, 200, { reviews: data ?? [] });
    return;
  }
  if (method === "POST") {
    const auth = await customer(request);
    const body = await readJson(request);
    const slug = text(body.productSlug, "Product slug", { min: 1, max: 120 });
    const rating = Number(body.rating);
    const title = text(body.title ?? "", "Review title", { max: 100, optional: true });
    const reviewBody = text(body.body, "Review", { min: 10, max: 3000 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Choose a valid product and a rating from 1 to 5 stars.");
    const { data: product, error: productError } = await auth.client.from("products")
      .select("id").eq("slug", slug).eq("status", "active").maybeSingle();
    assertNoDbError(productError, "Could not verify this product.");
    if (!product) throw new HttpError(404, "This product is not available for reviews.");
    const metadataName = auth.user.user_metadata?.full_name;
    const customerName = typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim().slice(0, 120)
      : (auth.user.email?.split("@")[0] || "Customer").slice(0, 120);
    const { error } = await auth.client.from("reviews").insert({
      product_id: product.id, product_slug: slug, customer_id: auth.user.id,
      customer_name: customerName, rating, title: title || null, body: reviewBody, status: "pending",
    });
    if (error?.code === "23505") throw new HttpError(409, "You have already reviewed this product.");
    assertNoDbError(error, "Your review could not be submitted.");
    send(response, 201, { success: true, message: "Thanks. Your review is awaiting approval." });
    return;
  }
  if (method === "PATCH") {
    const auth = await admin(request);
    const body = await readJson(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || !["pending", "published", "hidden"].includes(body.status)) throw new HttpError(400, "Choose a valid review and status.");
    const { error } = await auth.service.from("reviews").update({ status: body.status }).eq("id", body.id);
    assertNoDbError(error, "The review status could not be updated.");
    send(response, 200, { success: true });
    return;
  }
  throw new HttpError(405, "This method is not supported for reviews.");
}

async function handleProfit(request, response, url) {
  const auth = await admin(request);
  const requested = Number(url.searchParams.get("year"));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : new Date().getFullYear();
  const { data, error } = await auth.service.from("orders")
    .select("placed_at,order_items(unit_cost_bdt,quantity,line_total_bdt)")
    .in("status", saleStatuses)
    .gte("placed_at", `${year}-01-01T00:00:00.000Z`)
    .lt("placed_at", `${year + 1}-01-01T00:00:00.000Z`)
    .order("placed_at", { ascending: true });
  assertNoDbError(error, "The sales and profit report could not be loaded.");
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, revenue: 0, knownCost: 0, profit: 0, orderCount: 0, missingCostItems: 0 }));
  for (const order of data ?? []) {
    const month = months[new Date(order.placed_at).getUTCMonth()];
    month.orderCount += 1;
    for (const item of order.order_items ?? []) {
      const revenue = Number(item.line_total_bdt) || 0;
      month.revenue += revenue;
      if (item.unit_cost_bdt == null) month.missingCostItems += 1;
      else {
        const cost = (Number(item.unit_cost_bdt) || 0) * item.quantity;
        month.knownCost += cost;
        month.profit += revenue - cost;
      }
    }
  }
  const totals = months.reduce((sum, month) => ({
    revenue: sum.revenue + month.revenue, knownCost: sum.knownCost + month.knownCost,
    partialProfit: sum.partialProfit + month.profit, orderCount: sum.orderCount + month.orderCount,
    missingCostItems: sum.missingCostItems + month.missingCostItems,
  }), { revenue: 0, knownCost: 0, partialProfit: 0, orderCount: 0, missingCostItems: 0 });
  send(response, 200, { year, months, totals: { ...totals, grossProfit: totals.missingCostItems ? null : totals.partialProfit } });
}

function getSslCommerzSettings() {
  if (!config.sslcommerzStoreId || !config.sslcommerzStorePassword) {
    throw new HttpError(503, "Online payments are not configured yet. The store administrator must add the SSLCOMMERZ merchant credentials on the server.");
  }
  if (config.sslcommerzStoreId.length > 30 || config.sslcommerzStorePassword.length > 30) {
    throw new HttpError(503, "The SSLCOMMERZ credentials are not valid for this gateway configuration.");
  }
  let apiUrl;
  let siteUrl;
  try {
    apiUrl = new URL(config.publicApiUrl);
    siteUrl = new URL(config.publicSiteUrl);
  } catch {
    throw new HttpError(503, "Set PUBLIC_API_URL and PUBLIC_SITE_URL before enabling online payments.");
  }
  if (apiUrl.protocol !== "https:" || !config.publicSiteUrl || !["https:", "http:"].includes(siteUrl.protocol)
      || apiUrl.username || apiUrl.password || siteUrl.username || siteUrl.password
      || ["localhost", "127.0.0.1", "::1"].includes(apiUrl.hostname)) {
    throw new HttpError(503, "SSLCOMMERZ callbacks require a public HTTPS backend URL and a valid storefront URL.");
  }
  apiUrl.pathname = apiUrl.pathname.replace(/\/+$/, "");
  siteUrl.pathname = siteUrl.pathname.replace(/\/+$/, "");
  const gatewayHost = config.sslcommerzLive ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
  return { apiUrl, siteUrl, gatewayHost };
}

async function startSslCommerzSession({ settings, transactionId, order, saved, body, customerName, customerEmail, customerPhone, address, city, postalCode, items }) {
  const callbackUrl = (type) => new URL(`/api/payments/sslcommerz/${type}`, settings.apiUrl).toString();
  const parameters = new URLSearchParams({
    store_id: config.sslcommerzStoreId,
    store_passwd: config.sslcommerzStorePassword,
    total_amount: Number(saved.total_bdt).toFixed(2),
    currency: "BDT",
    tran_id: transactionId,
    success_url: callbackUrl("success"),
    fail_url: callbackUrl("fail"),
    cancel_url: callbackUrl("cancel"),
    ipn_url: callbackUrl("ipn"),
    multi_card_name: order.payment_method === "bkash" ? "bkash" : "visacard,mastercard",
    product_name: items.map((item) => item.product_name).join(", ").slice(0, 255),
    product_category: "home-decor",
    product_profile: "physical-goods",
    shipping_method: "YES",
    num_of_item: String(items.reduce((sum, item) => sum + item.quantity, 0)),
    cus_name: customerName.slice(0, 50),
    cus_email: customerEmail.slice(0, 50),
    cus_add1: address.slice(0, 50),
    cus_city: city.slice(0, 50),
    cus_postcode: postalCode.slice(0, 30),
    cus_country: "Bangladesh",
    cus_phone: customerPhone.slice(0, 20),
    ship_name: customerName.slice(0, 50),
    ship_add1: address.slice(0, 50),
    ship_area: city.slice(0, 50),
    ship_city: city.slice(0, 50),
    ship_postcode: postalCode.slice(0, 50),
    ship_country: "Bangladesh",
  });
  let providerResponse;
  try {
    providerResponse = await fetch(`${settings.gatewayHost}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: parameters,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(502, `Your order CL-${saved.order_number} is saved as pending, but the payment gateway did not respond. Contact the store before retrying.`);
  }
  const responseBody = await providerResponse.json().catch(() => null);
  const redirectUrl = typeof responseBody?.GatewayPageURL === "string" ? responseBody.GatewayPageURL : "";
  let parsedRedirect;
  try { parsedRedirect = new URL(redirectUrl); } catch { /* handled below */ }
  if (!providerResponse.ok || responseBody?.status !== "SUCCESS" || !parsedRedirect
      || parsedRedirect.protocol !== "https:"
      || !["sandbox.sslcommerz.com", "securepay.sslcommerz.com"].includes(parsedRedirect.hostname)) {
    console.error("SSLCOMMERZ session initiation failed:", responseBody?.failedreason ?? `HTTP ${providerResponse.status}`);
    if (responseBody?.status === "FAILED") {
      const service = getAdminDb();
      const { error } = await service.rpc("close_store_payment", {
        transaction_id: transactionId,
        final_status: "failed",
        validated_amount: Number(saved.total_bdt),
        validated_currency: "BDT",
      });
      assertNoDbError(error, "The rejected payment could not be closed safely.");
      throw new HttpError(502, "The payment provider rejected this checkout before a payment session was created. Your bag is saved; please review it and try again.");
    }
    throw new HttpError(502, `Your order CL-${saved.order_number} is saved as pending, but the payment session could not be started. Contact the store before retrying.`);
  }
  const service = getAdminDb();
  const { error } = await service.from("payment_transactions")
    .update({ gateway_session_key: typeof responseBody.sessionkey === "string" ? responseBody.sessionkey : null, updated_at: new Date().toISOString() })
    .eq("provider_transaction_id", transactionId).eq("status", "pending");
  if (error) console.error("SSLCOMMERZ session key could not be saved:", error.code ?? "unknown");
  return parsedRedirect.toString();
}

async function handleCreateOrder(request, response, { onlinePayment = false } = {}) {
  const auth = await customer(request);
  if (auth.user.is_anonymous) throw new HttpError(401, "Create an account or sign in before checkout.");
  const gatewaySettings = onlinePayment ? getSslCommerzSettings() : null;
  const service = getAdminDb();
  const body = await readJson(request);
  const customerName = text(body.customer?.name, "Full name", { min: 2, max: 120 });
  const customerEmail = text(body.customer?.email, "Email address", { min: 3, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new HttpError(400, "Enter a valid email address.");
  const customerPhone = text(body.customer?.phone, "Phone number", { min: 7, max: 19 });
  if (!/^[+\d][\d\s().-]{6,18}$/.test(customerPhone)) throw new HttpError(400, "Enter a valid phone number.");
  const address = text(body.shipping?.address, "Street address", { min: 5, max: 600 });
  const city = text(body.shipping?.city, "City", { min: 2, max: 120 });
  const postalCode = text(body.shipping?.postalCode, "Postal code", { min: 2, max: 24 });
  const deliveryMethod = body.deliveryMethod === "express" ? "express" : body.deliveryMethod === "standard" ? "standard" : "";
  const paymentMethod = ["bkash", "cod"].includes(body.paymentMethod) ? body.paymentMethod : "";
  if (!deliveryMethod || !paymentMethod || (onlinePayment ? paymentMethod === "cod" : paymentMethod !== "cod")) {
    throw new HttpError(400, onlinePayment ? "Choose bKash for online payment." : "Cash on delivery is the only payment method available on this order route.");
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) throw new HttpError(400, "Your order must contain between 1 and 30 items.");

  const customerId = auth.user.id;
  const { error: profileError } = await service.from("profiles").upsert({
    id: customerId,
    full_name: customerName,
    phone: customerPhone,
  }, { onConflict: "id" });
  assertNoDbError(profileError, "Your customer details could not be verified.");

  const requested = body.items.map((item) => {
    const productSlug = text(item?.productId, "Product", { min: 1, max: 120 });
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new HttpError(400, "Each item quantity must be between 1 and 50.");
    return { productSlug, quantity, options: item?.options && typeof item.options === "object" ? item.options : {} };
  });
  const slugs = [...new Set(requested.map((item) => item.productSlug))];
  const { data: products, error: productError } = await service.from("products")
    .select("id,slug,name,sku,price_bdt,inventory_quantity,track_inventory,made_to_order,status,attributes,swatches")
    .in("slug", slugs).eq("status", "active");
  assertNoDbError(productError, "Product prices could not be verified.");
  const bySlug = new Map((products ?? []).map((product) => [product.slug, product]));
  const quantities = new Map();
  const items = requested.map(({ productSlug, quantity, options }) => {
    const product = bySlug.get(productSlug);
    if (!product) throw new HttpError(400, "A product in your bag is no longer available.");
    const attributes = product.attributes ?? {};
    const optionPrice = (collection, label, optionName) => {
      if (!label) return 0;
      const option = (attributes[collection] ?? []).find((candidate) => candidate.label === label);
      if (!option) throw new HttpError(400, `The selected ${optionName} is no longer available for ${product.name}.`);
      return Number(option.delta ?? 0);
    };
    if (options.color && !(product.swatches ?? []).some((swatch) => swatch.label === options.color)) throw new HttpError(400, `The selected colour is no longer available for ${product.name}.`);
    const unitPrice = Number(product.price_bdt)
      + optionPrice("sizes", options.size, "size")
      + optionPrice("fabrics", options.fabric, "fabric")
      + optionPrice("legs", options.legFinish, "finish");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new HttpError(400, `The selected options produce an invalid price for ${product.name}.`);
    if (product.track_inventory && !product.made_to_order) {
      const reserved = (quantities.get(product.id) ?? 0) + quantity;
      if (reserved > product.inventory_quantity) throw new HttpError(409, `${product.name} does not have enough stock for that quantity.`);
      quantities.set(product.id, reserved);
    }
    return {
      product_id: product.id, product_name: product.name, product_sku: product.sku,
      selected_options: { size: options.size ?? null, color: options.color ?? null, fabric: options.fabric ?? null, legFinish: options.legFinish ?? null },
      unit_price_bdt: unitPrice, quantity, line_total_bdt: Math.round(unitPrice * quantity * 100) / 100,
    };
  });
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.line_total_bdt, 0) * 100) / 100;
  const deliveryFee = deliveryMethod === "express" ? 1500 : 0;
  const transactionId = onlinePayment ? `CL${randomBytes(13).toString("hex")}` : null;
  const order = {
    customer_id: customerId, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone,
    status: "pending", payment_status: "pending", payment_method: paymentMethod,
    shipping_address: { address, city, postalCode, country: "Bangladesh", deliveryMethod },
    subtotal_bdt: subtotal, delivery_fee_bdt: deliveryFee,
    coupon_code: body.couponCode ? text(body.couponCode, "Coupon code", { min: 1, max: 64 }).trim().toUpperCase() : null,
    redeem_rewards: body.redeemRewards === true,
    payment_transaction_id: transactionId,
    customer_note: text(body.customerNote ?? "", "Order note", { max: 1000, optional: true }) || null,
  };
  const { data: saved, error: orderError } = await service.rpc("create_store_order", {
    order_data: order,
    item_data: items,
  });
  if (orderError) {
    if (/not enough product inventory|stock changed/i.test(orderError.message ?? "")) {
      throw new HttpError(409, "Stock just changed. Please review your bag and try again.");
    }
    if (/product is no longer available/i.test(orderError.message ?? "")) {
      throw new HttpError(409, "A product in your bag is no longer available.");
    }
    if (/coupon/i.test(orderError.message ?? "")) throw new HttpError(409, orderError.message);
    if (/reward|sign in to redeem/i.test(orderError.message ?? "")) throw new HttpError(409, orderError.message);
    if (/online payment totals/i.test(orderError.message ?? "")) throw new HttpError(400, orderError.message);
    assertNoDbError(orderError, "Your order could not be created.");
  }
  if (!saved || typeof saved.id !== "string" || saved.order_number == null) {
    throw new HttpError(502, "The order could not be confirmed. Please contact support before retrying.");
  }
  const result = {
    success: true,
    orderId: saved.id,
    orderNumber: `CL-${saved.order_number}`,
    total: Number(saved.total_bdt),
    subtotal: Number(saved.subtotal_bdt),
    discount: Number(saved.discount_bdt),
    couponDiscount: Number(saved.coupon_discount_bdt),
    rewardDiscount: Number(saved.reward_discount_bdt),
    rewardPointsRedeemed: Number(saved.reward_points_redeemed),
    status: "pending",
  };
  if (onlinePayment) {
    try {
      result.redirectUrl = await startSslCommerzSession({
        settings: gatewaySettings, transactionId, order, saved, body,
        customerName, customerEmail, customerPhone, address, city, postalCode, items,
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error("SSLCOMMERZ session could not be recorded:", error?.message ?? "unknown error");
      throw new HttpError(502, `Your order ${result.orderNumber} is saved as pending, but the payment session could not be recorded. Contact the store before retrying.`);
    }
    result.transactionId = transactionId;
    send(response, 201, result);
    return;
  }
  send(response, 201, result);
}

async function handleOrders(request, response, method, url) {
  const auth = await admin(request);
  if (method === "GET") {
    let query = auth.service.from("orders")
      .select("*,order_items(id,product_name,product_sku,quantity,unit_price_bdt,line_total_bdt,selected_options),order_status_events(id,from_status,to_status,actor_email,note,created_at)")
      .order("placed_at", { ascending: false }).limit(100);
    query = url.searchParams.get("view") === "archive"
      ? query.not("archived_at", "is", null)
      : query.is("archived_at", null);
    const status = url.searchParams.get("status");
    if (status && orderStatuses.has(status)) query = query.eq("status", status);
    const { data, error } = await query;
    assertNoDbError(error, "Could not load orders.");
    const orderIds = (data ?? []).map((order) => order.id);
    const { data: payments, error: paymentError } = orderIds.length
      ? await auth.service.from("payment_transactions").select("order_id,status,risk_level").in("order_id", orderIds)
      : { data: [], error: null };
    assertNoDbError(paymentError, "Order payment status could not be loaded.");
    const paymentByOrder = new Map((payments ?? []).map((payment) => [payment.order_id, payment]));
    send(response, 200, { orders: (data ?? []).map((order) => ({ ...order, payment_transaction: paymentByOrder.get(order.id) ?? null })) });
    return;
  }
  if (method === "DELETE") {
    const body = await readJson(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new HttpError(400, "Choose a valid order.");
    const { error } = await auth.service.rpc("admin_delete_archived_order", { p_order_id: body.id });
    if (error?.code === "P0002") throw new HttpError(404, error.message);
    if (error?.code === "22023") throw new HttpError(409, error.message);
    assertNoDbError(error, "The order could not be permanently deleted. Apply the latest Supabase migration and try again.");
    send(response, 200, { ok: true });
    return;
  }
  if (method === "PATCH") {
    const body = await readJson(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new HttpError(400, "Choose a valid order.");
    if (body.action === "archive" || body.action === "restore") {
      const archivedAt = body.action === "archive" ? new Date().toISOString() : null;
      let update = auth.service.from("orders").update({ archived_at: archivedAt }).eq("id", body.id);
      update = archivedAt ? update.is("archived_at", null) : update.not("archived_at", "is", null);
      const { data, error } = await update.select("id,archived_at").maybeSingle();
      assertNoDbError(error, "The order archive could not be updated. Apply the latest Supabase migration and try again.");
      if (!data) throw new HttpError(409, body.action === "archive" ? "This order is already archived or no longer exists." : "This order is not archived or no longer exists.");
      send(response, 200, { ok: true, order: data });
      return;
    }
    const { data: currentOrder, error: currentOrderError } = await auth.service.from("orders")
      .select("archived_at").eq("id", body.id).maybeSingle();
    assertNoDbError(currentOrderError, "The order could not be loaded.");
    if (!currentOrder) throw new HttpError(404, "Order not found.");
    if (currentOrder.archived_at) throw new HttpError(409, "Restore the order before changing its status or recording a refund.");
    const note = body.admin_note == null ? null : text(body.admin_note, "Admin note", { max: 4000, optional: true });
    if (body.action === "record_refund") {
      const reference = text(body.reference, "Refund reference", { min: 1, max: 120 });
      const { data, error } = await auth.service.rpc("admin_record_order_refund", {
        p_order_id: body.id, p_reference: reference, p_actor_user_id: auth.user.id,
        p_actor_email: auth.user.email ?? "Admin", p_note: note,
      });
      if (error?.code === "22023") throw new HttpError(409, error.message);
      assertNoDbError(error, "The refund could not be recorded. Apply the latest Supabase migration and try again.");
      send(response, 200, { ok: true, order: data });
      return;
    }
    if (!orderStatuses.has(body.status)) throw new HttpError(400, "Choose a valid order status.");
    const { data, error } = await auth.service.rpc("admin_change_order_status", {
      p_order_id: body.id, p_status: body.status, p_actor_user_id: auth.user.id,
      p_actor_email: auth.user.email ?? "Admin", p_note: note,
    });
    if (["22023", "P0002"].includes(error?.code)) throw new HttpError(error.code === "P0002" ? 404 : 409, error.message);
    assertNoDbError(error, "The order could not be updated. Apply the latest Supabase migration and try again.");
    send(response, 200, { ok: true, order: data });
    return;
  }
  throw new HttpError(405, "This method is not supported for orders.");
}

async function steadfastRequest(path, init = {}) {
  if (!config.steadfastApiKey || !config.steadfastSecretKey) {
    throw new HttpError(503, "Steadfast is not configured. Add the server-only courier credentials and restart the API.");
  }
  let upstream;
  try {
    upstream = await fetch(`${config.steadfastApiUrl.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: {
        "Api-Key": config.steadfastApiKey,
        "Secret-Key": config.steadfastSecretKey,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(504, "Steadfast did not confirm the request. Check the shipment status before trying again.");
  }
  let data;
  try { data = await upstream.json(); }
  catch { throw new HttpError(502, "Steadfast returned an unreadable response. Check the shipment status before trying again."); }
  return { response: upstream, data };
}

function courierStatusValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 80) : "unknown";
}

function courierPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^8801\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^01\d{9}$/.test(digits)) return digits;
  return "";
}

async function syncOrderStatusFromCourier(service, order, courierStatus, actor) {
  const inTransit = new Set(["picked_up", "in_transit", "on_the_way", "out_for_delivery"]);
  const delivered = new Set(["delivered", "partial_delivered"]);
  const target = delivered.has(courierStatus) ? "delivered" : inTransit.has(courierStatus) ? "shipped" : null;
  if (!target) return;
  let status = order.status;
  const steps = status === "confirmed" ? ["processing", "shipped"]
    : status === "processing" ? ["shipped"]
      : status === "shipped" ? [] : [];
  if (target === "delivered" && status !== "shipped") {
    if (status === "confirmed") steps.push("processing", "shipped");
    else if (status === "processing") steps.push("shipped");
  }
  if (status !== "confirmed" && status !== "processing" && status !== "shipped") return;
  if (target === "shipped" && status === "shipped") return;
  if (target === "shipped" && status === "confirmed") steps.splice(0, steps.length, "processing", "shipped");
  if (target === "shipped" && status === "processing") steps.splice(0, steps.length, "shipped");
  if (target === "delivered") steps.push("delivered");
  for (const nextStatus of [...new Set(steps)]) {
    const { error } = await service.rpc("admin_change_order_status", {
      p_order_id: order.id, p_status: nextStatus, p_actor_user_id: actor?.id ?? null,
      p_actor_email: actor?.email ?? "Steadfast status update", p_note: `Updated from Steadfast status: ${courierStatus}`,
    });
    assertNoDbError(error, "Steadfast status was saved, but the order status could not be synchronized. Apply the latest Supabase migration and retry Sync status.");
    status = nextStatus;
  }
}

async function handleAdminSteadfast(request, response) {
  const auth = await admin(request);
  const body = await readJson(request);
  if (typeof body.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.orderId)) throw new HttpError(400, "Choose a valid order.");
  const { data: order, error } = await auth.service.from("orders")
    .select("id,order_number,customer_name,customer_email,customer_phone,status,payment_status,payment_method,shipping_address,total_bdt,customer_note,courier_invoice,courier_consignment_id,courier_tracking_code,courier_status,courier_return_request_id,courier_return_status,courier_message,courier_updated_at,courier_submitted_at,order_items(product_name,quantity)")
    .eq("id", body.orderId).maybeSingle();
  assertNoDbError(error, "The order could not be loaded.");
  if (!order) throw new HttpError(404, "Order not found.");
  if (body.action === "return") {
    if (!order.courier_consignment_id) throw new HttpError(409, "Create a Steadfast shipment before requesting a return.");
    if (!["delivered", "partial_delivered"].includes(order.courier_status)) throw new HttpError(409, "A return request is available after Steadfast marks the shipment delivered.");
    if (order.courier_return_request_id || order.courier_return_status === "submitting") throw new HttpError(409, "A return request already exists or is being submitted.");
    const reason = text(body.reason ?? "", "Return reason", { max: 250, optional: true });
    const { data: claimed, error: claimError } = await auth.service.from("orders")
      .update({ courier_return_status: "submitting", courier_updated_at: new Date().toISOString() })
      .eq("id", order.id).is("courier_return_request_id", null).or("courier_return_status.is.null,courier_return_status.eq.failed").select("id").maybeSingle();
    assertNoDbError(claimError, "The return request could not be reserved.");
    if (!claimed) throw new HttpError(409, "A return request is already in progress.");
    let result;
    try {
      result = await steadfastRequest("/create_return_request", {
        method: "POST",
        body: JSON.stringify({ consignment_id: order.courier_consignment_id, ...(reason ? { reason } : {}) }),
      });
    } catch (failure) {
      await auth.service.from("orders").update({ courier_return_status: failure.status === 502 || failure.status === 504 ? "submission_unknown" : "failed" }).eq("id", order.id);
      throw failure;
    }
    if (!result.response.ok || !result.data?.id) {
      await auth.service.from("orders").update({ courier_return_status: result.response.status >= 400 && result.response.status < 500 ? "failed" : "submission_unknown" }).eq("id", order.id);
      throw new HttpError(502, "Steadfast did not confirm the return request. Check its return requests before trying again.");
    }
    const update = { courier_return_request_id: Number(result.data.id), courier_return_status: courierStatusValue(result.data.status ?? "pending"), courier_updated_at: new Date().toISOString() };
    const { error: saveError } = await auth.service.from("orders").update(update).eq("id", order.id);
    assertNoDbError(saveError, "Steadfast created the return request, but its reference could not be saved. Check Steadfast before retrying.");
    send(response, 201, { ok: true, ...update });
    return;
  }
  if (body.action === "sync") {
    if (!order.courier_invoice) throw new HttpError(409, "This order has no Steadfast invoice to check.");
    const result = await steadfastRequest(`/status_by_invoice/${encodeURIComponent(order.courier_invoice)}`, { method: "GET" });
    if (!result.response.ok || !result.data?.delivery_status) throw new HttpError(502, "Steadfast could not confirm this shipment status. It is safe to check again later.");
    const update = { courier_status: courierStatusValue(result.data.delivery_status), courier_updated_at: new Date().toISOString() };
    const { error: updateError } = await auth.service.from("orders").update(update).eq("id", order.id);
    assertNoDbError(updateError, "The shipment status was read but could not be saved.");
    await syncOrderStatusFromCourier(auth.service, order, update.courier_status, auth.user);
    const { data: current, error: currentError } = await auth.service.from("orders").select("status,payment_status,order_status_events(id,from_status,to_status,actor_email,note,created_at)").eq("id", order.id).single();
    assertNoDbError(currentError, "Courier status was synchronized, but the updated order could not be loaded.");
    send(response, 200, { ok: true, ...update, trackingCode: order.courier_tracking_code, consignmentId: order.courier_consignment_id, orderStatus: current.status, paymentStatus: current.payment_status, events: current.order_status_events ?? [] });
    return;
  }
  if (body.action !== "create") throw new HttpError(400, "Choose create or sync.");
  if (order.courier_consignment_id || order.courier_tracking_code || ["submitting", "submission_unknown"].includes(order.courier_status)) {
    throw new HttpError(409, "This order already has a shipment or an unconfirmed submission. Sync its status before taking another action.");
  }
  if (!["confirmed", "processing"].includes(order.status)) throw new HttpError(409, "Confirm or begin processing the order before creating its shipment.");
  if (order.payment_method === "cod") {
    // COD can be handed to the courier while awaiting collection.
  } else if (order.payment_status !== "paid") {
    throw new HttpError(409, "Online payment must be confirmed before creating the shipment.");
  }
  const address = order.shipping_address ?? {};
  const recipientAddress = [address.address, address.city, address.postalCode].filter(Boolean).join(", ").trim();
  const recipientPhone = courierPhone(order.customer_phone);
  if (!recipientPhone) throw new HttpError(400, "Steadfast requires an 11-digit Bangladesh mobile number beginning with 01.");
  if (!recipientAddress || recipientAddress.length > 250) throw new HttpError(400, "The delivery address must be between 1 and 250 characters for Steadfast.");
  if (order.customer_name.length > 100) throw new HttpError(400, "The customer name is longer than Steadfast allows.");
  const invoice = `CL-${order.order_number}`;
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await auth.service.from("orders")
    .update({ courier_invoice: invoice, courier_status: "submitting", courier_message: null, courier_updated_at: now })
    .eq("id", order.id).in("courier_status", ["not_submitted", "failed"]).select("id").maybeSingle();
  assertNoDbError(claimError, "The shipment could not be reserved for creation.");
  if (!claimed) throw new HttpError(409, "Another shipment request is already in progress or this order needs status reconciliation.");

  const itemDescription = (order.order_items ?? []).map((item) => `${item.product_name} × ${item.quantity}`).join(", ").slice(0, 500);
  const payload = {
    invoice,
    recipient_name: order.customer_name,
    recipient_phone: recipientPhone,
    recipient_email: order.customer_email,
    recipient_address: recipientAddress,
    cod_amount: order.payment_method === "cod" ? Number(order.total_bdt) : 0,
    note: typeof order.customer_note === "string" ? order.customer_note.slice(0, 250) : "",
    item_description: itemDescription,
    total_lot: (order.order_items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    delivery_type: 0,
  };
  let result;
  try {
    result = await steadfastRequest("/create_order", { method: "POST", body: JSON.stringify(payload) });
  } catch (failure) {
    const uncertain = failure.status === 504 || failure.status === 502;
    const update = { courier_status: uncertain ? "submission_unknown" : "failed", courier_message: failure.message, courier_updated_at: new Date().toISOString() };
    await auth.service.from("orders").update(update).eq("id", order.id);
    throw failure;
  }
  const consignment = result.data?.consignment;
  if (!result.response.ok || !consignment || !consignment.consignment_id || !consignment.tracking_code) {
    const rejected = result.response.status >= 400 && result.response.status < 500;
    const update = { courier_status: rejected ? "failed" : "submission_unknown", courier_message: "Steadfast did not confirm the shipment creation.", courier_updated_at: new Date().toISOString() };
    await auth.service.from("orders").update(update).eq("id", order.id);
    throw new HttpError(rejected ? 502 : 504, rejected
      ? "Steadfast rejected the shipment. Review the delivery details before retrying."
      : "Steadfast did not confirm the shipment. Sync its status before trying again.");
  }
  const update = {
    courier_consignment_id: Number(consignment.consignment_id),
    courier_tracking_code: String(consignment.tracking_code),
    courier_status: courierStatusValue(consignment.status ?? "in_review"),
    courier_message: null,
    courier_updated_at: new Date().toISOString(),
    courier_submitted_at: new Date().toISOString(),
  };
  const { error: saveError } = await auth.service.from("orders").update(update).eq("id", order.id);
  assertNoDbError(saveError, "Steadfast created the shipment, but its reference could not be saved. Do not create another shipment; use Sync status.");
  send(response, 201, { ok: true, ...update, trackingCode: update.courier_tracking_code, consignmentId: update.courier_consignment_id });
}

async function handleSteadfastWebhook(request, response) {
  const configured = config.steadfastWebhookToken;
  const supplied = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const expectedBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  if (!configured || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new HttpError(401, "Webhook authentication failed.");
  }
  const body = await readJson(request);
  if (!["delivery_status", "tracking_update"].includes(body.notification_type) || typeof body.invoice !== "string") {
    throw new HttpError(400, "The courier update is invalid.");
  }
  const service = getAdminDb();
  const update = {
    courier_updated_at: new Date().toISOString(),
    courier_message: typeof body.tracking_message === "string" ? body.tracking_message.slice(0, 500) : null,
  };
  if (body.notification_type === "delivery_status") update.courier_status = courierStatusValue(body.status);
  const { data, error } = await service.from("orders").update(update).eq("courier_invoice", body.invoice).select("*").maybeSingle();
  assertNoDbError(error, "The courier update could not be saved.");
  if (!data) throw new HttpError(404, "No order matches this courier invoice.");
  if (update.courier_status) await syncOrderStatusFromCourier(service, data, update.courier_status, null);
  send(response, 200, { status: "success", message: "Webhook received successfully." });
}

async function handleCustomerOrders(request, response) {
  const auth = await customer(request);
  const { data, error } = await auth.client.from("orders")
    .select("id,order_number,placed_at,status,payment_status,payment_method,total_bdt,courier_tracking_code,courier_status,courier_return_status,courier_message,courier_updated_at,order_status_events(id,from_status,to_status,created_at,note),order_items(product_name,quantity)")
    .eq("customer_id", auth.user.id).order("placed_at", { ascending: false }).limit(50);
  assertNoDbError(error, "Your order history could not be loaded.");
  send(response, 200, { orders: data ?? [] });
}

async function handleCustomerCustomRequests(request, response) {
  const auth = await customer(request);
  const { data, error } = await auth.client.from("custom_requests")
    .select("id,request_number,status,quoted_price_bdt,created_at,custom_request_status_events(id,from_status,to_status,created_at,note)")
    .eq("customer_id", auth.user.id).order("created_at", { ascending: false }).limit(50);
  assertNoDbError(error, "Your custom request status could not be loaded.");
  send(response, 200, { requests: data ?? [] });
}

async function handleCustomRequests(request, response, method, url) {
  if (method === "GET") {
    const auth = await admin(request);
    let query = auth.service.from("custom_requests")
      .select("id,request_number,full_name,phone,email,city_area,delivery_address,description,status,admin_note,quoted_price_bdt,created_at,archived_at,custom_request_status_events(id,from_status,to_status,actor_email,note,created_at),custom_request_images(id,file_name,storage_path,sort_order)")
      .order("created_at", { ascending: false });
    query = url.searchParams.get("view") === "archive"
      ? query.not("archived_at", "is", null)
      : query.is("archived_at", null);
    const { data, error } = await query;
    assertNoDbError(error, "Could not load custom product requests.");
    const rows = await Promise.all((data ?? []).map(async (item) => {
      const images = await Promise.all([...(item.custom_request_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(async (image) => {
        const { data: signed } = await auth.service.storage.from(config.customReferenceBucket).createSignedUrl(image.storage_path, 1800);
        return { id: image.id, file_name: image.file_name, signed_url: signed?.signedUrl ?? null };
      }));
      return { ...item, images };
    }));
    send(response, 200, { requests: rows });
    return;
  }
  if (method === "PATCH") {
    const auth = await admin(request);
    const body = await readJson(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new HttpError(400, "Choose a valid custom request.");
    if (body.action === "archive" || body.action === "restore") {
      const archivedAt = body.action === "archive" ? new Date().toISOString() : null;
      let update = auth.service.from("custom_requests").update({ archived_at: archivedAt }).eq("id", body.id);
      update = archivedAt ? update.is("archived_at", null) : update.not("archived_at", "is", null);
      const { data, error } = await update.select("id,archived_at").maybeSingle();
      assertNoDbError(error, "The request archive could not be updated. Apply the latest Supabase migration and try again.");
      if (!data) throw new HttpError(409, body.action === "archive" ? "This request is already archived or no longer exists." : "This request is not archived or no longer exists.");
      send(response, 200, { ok: true, request: data });
      return;
    }
    const { data: currentRequest, error: currentRequestError } = await auth.service.from("custom_requests")
      .select("archived_at").eq("id", body.id).maybeSingle();
    assertNoDbError(currentRequestError, "The custom request could not be loaded.");
    if (!currentRequest) throw new HttpError(404, "Custom request not found.");
    if (currentRequest.archived_at) throw new HttpError(409, "Restore the request before changing its status.");
    const statuses = new Set(["new", "reviewing", "quoted", "completed", "declined", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || !statuses.has(body.status)) {
      throw new HttpError(400, "Choose a valid custom request and status.");
    }
    const quote = body.quoted_price_bdt == null || body.quoted_price_bdt === "" ? null : Number(body.quoted_price_bdt);
    if (quote !== null && (!Number.isFinite(quote) || quote < 0 || quote > 100000000)) throw new HttpError(400, "Enter a valid quote amount in BDT.");
    const note = body.admin_note == null ? null : text(body.admin_note, "Admin note", { max: 4000, optional: true });
    const { data, error } = await auth.service.rpc("admin_change_custom_request_status", {
      p_request_id: body.id, p_status: body.status, p_actor_user_id: auth.user.id,
      p_actor_email: auth.user.email ?? "Admin", p_note: note, p_quoted_price_bdt: quote,
    });
    if (["22023", "P0002"].includes(error?.code)) throw new HttpError(error.code === "P0002" ? 404 : 409, error.message);
    assertNoDbError(error, "The custom request status could not be updated. Apply the latest Supabase migration and try again.");
    send(response, 200, { ok: true, request: data });
    return;
  }
  if (method === "DELETE") {
    const auth = await admin(request);
    const body = await readJson(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new HttpError(400, "Choose a valid custom request.");
    const { data: requestRow, error: requestError } = await auth.service.from("custom_requests")
      .select("id,archived_at").eq("id", body.id).maybeSingle();
    assertNoDbError(requestError, "The request could not be loaded.");
    if (!requestRow) throw new HttpError(404, "Custom request not found.");
    if (!requestRow.archived_at) throw new HttpError(409, "Archive the request before permanently deleting it.");
    const { data: images, error: imageError } = await auth.service.from("custom_request_images")
      .select("storage_path").eq("request_id", body.id);
    assertNoDbError(imageError, "The request reference photos could not be loaded.");
    const { data: deleted, error: deleteError } = await auth.service.from("custom_requests")
      .delete().eq("id", body.id).not("archived_at", "is", null).select("id").maybeSingle();
    assertNoDbError(deleteError, "The request could not be permanently deleted.");
    if (!deleted) throw new HttpError(409, "The request was restored before it could be deleted.");
    const storagePaths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
    const { error: storageError } = storagePaths.length
      ? await auth.service.storage.from(config.customReferenceBucket).remove(storagePaths)
      : { error: null };
    send(response, 200, {
      ok: true,
      ...(storageError ? { warning: "The request was deleted, but some reference photos could not be removed from Storage." } : {}),
    });
    return;
  }
  if (method !== "POST") throw new HttpError(405, "This method is not supported for custom requests.");
  const service = getAdminDb();
  const contentType = String(request.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("multipart/form-data")) throw new HttpError(415, "Submit the custom request as a multipart form.");
  let customerId = null;
  const authorization = request.headers.authorization;
  if (authorization) {
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) throw new HttpError(401, "Your customer session is invalid or has expired.");
    const user = await verifyAccessToken(accessToken);
    if (!user) throw new HttpError(401, "Your customer session is invalid or has expired.");
    customerId = user.id;
    const metadataName = user.user_metadata?.full_name;
    const profile = { id: user.id };
    if (typeof metadataName === "string" && metadataName.trim()) profile.full_name = metadataName.trim().slice(0, 120);
    const { error: profileError } = await service.from("profiles").upsert(profile, { onConflict: "id" });
    assertNoDbError(profileError, "Your customer details could not be verified.");
  }
  const bytes = await readBytes(request, 25 * 1024 * 1024);
  let form;
  try {
    const webRequest = new Request("http://backend.local/api/custom-requests", { method: "POST", headers: { "content-type": contentType }, body: bytes });
    form = await webRequest.formData();
  } catch { throw new HttpError(400, "The custom request form could not be read."); }
  if (String(form.get("website") ?? "").trim()) { send(response, 200, { success: true }); return; }
  const fullName = text(String(form.get("fullName") ?? ""), "Full name", { min: 2, max: 120 });
  const phone = text(String(form.get("phone") ?? ""), "Phone number", { min: 7, max: 19 });
  if (!/^[+\d][\d\s().-]{6,18}$/.test(phone)) throw new HttpError(400, "Enter a valid phone number.");
  const email = text(String(form.get("email") ?? ""), "Email address", { max: 254, optional: true }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const cityArea = text(String(form.get("cityArea") ?? ""), "City or area", { min: 2, max: 120 });
  const deliveryAddress = text(String(form.get("deliveryAddress") ?? ""), "Delivery address", { min: 5, max: 600 });
  const description = text(String(form.get("description") ?? ""), "Request description", { min: 10, max: 5000 });
  const files = form.getAll("photos").filter((value) => value instanceof File && value.size > 0);
  if (files.length > 4) throw new HttpError(400, "You can attach up to four reference photos.");
  if (files.some((file) => !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024)) throw new HttpError(400, "Reference photos must be JPG, PNG, WebP, or AVIF and no larger than 5 MB each.");
  const { data: saved, error: saveError } = await service.from("custom_requests").insert({ customer_id: customerId, full_name: fullName, phone, email: email || null, city_area: cityArea, delivery_address: deliveryAddress, description }).select("id,request_number").single();
  assertNoDbError(saveError, "The custom request could not be saved.");
  const storedPaths = [];
  const rows = [];
  try {
    for (const [sortOrder, file] of files.entries()) {
      const input = Buffer.from(await file.arrayBuffer());
      const { variants } = await optimizeImage(input);
      const optimized = variants.at(-1);
      const path = `${saved.id}/${randomUUID()}.webp`;
      const { error } = await service.storage.from(config.customReferenceBucket).upload(path, optimized.buffer, { contentType: "image/webp", cacheControl: "0", upsert: false });
      if (error) throw error;
      storedPaths.push(path);
      rows.push({ request_id: saved.id, storage_path: path, file_name: file.name.slice(0, 180), mime_type: "image/webp", size_bytes: optimized.buffer.length, sort_order: sortOrder });
    }
    if (rows.length) {
      const { error } = await service.from("custom_request_images").insert(rows);
      if (error) throw error;
    }
  } catch (error) {
    if (storedPaths.length) await service.storage.from(config.customReferenceBucket).remove(storedPaths);
    await service.from("custom_requests").delete().eq("id", saved.id);
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "A reference image could not be saved. Please try again.");
  }
  send(response, 201, { success: true, requestNumber: saved.request_number });
}

async function handleAdminOverview(request, response) {
  const auth = await admin(request);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [products, orders, pending, monthSales, recent, userPage] = await Promise.all([
    auth.service.from("products").select("id", { count: "exact", head: true }),
    auth.service.from("orders").select("id", { count: "exact", head: true }),
    auth.service.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    auth.service.from("orders").select("subtotal_bdt,status")
      .in("status", saleStatuses).gte("placed_at", monthStart.toISOString()),
    auth.service.from("orders").select("id,order_number,customer_name,customer_email,placed_at,total_bdt,status,payment_method,order_items(quantity)")
      .order("placed_at", { ascending: false }).limit(5),
    auth.service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const queryError = products.error ?? orders.error ?? pending.error ?? monthSales.error ?? recent.error ?? userPage.error;
  assertNoDbError(queryError, "Store overview could not be loaded.");
  const revenue = (monthSales.data ?? []).reduce((sum, order) => sum + (Number(order.subtotal_bdt) || 0), 0);
  send(response, 200, {
    summary: {
      productCount: products.count ?? 0,
      orderCount: orders.count ?? 0,
      customerCount: (userPage.data?.users ?? []).filter((user) => user.app_metadata?.role !== "admin").length,
      pendingOrderCount: pending.count ?? 0,
      monthOrderCount: monthSales.data?.length ?? 0,
      monthRevenueBdt: Math.round(revenue * 100) / 100,
    },
    recentOrders: recent.data ?? [],
  });
}

async function handleAdminCustomers(request, response) {
  const auth = await admin(request);
  const { data: userPage, error: usersError } = await auth.service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assertNoDbError(usersError, "Customer accounts could not be loaded.");
  const users = (userPage?.users ?? []).filter((user) => user.app_metadata?.role !== "admin");
  const userIds = users.map((user) => user.id);
  if (!userIds.length) { send(response, 200, { customers: [] }); return; }
  const [profiles, orders] = await Promise.all([
    auth.service.from("profiles").select("id,full_name,phone,created_at").in("id", userIds),
    auth.service.from("orders").select("customer_id,total_bdt,status").in("customer_id", userIds),
  ]);
  assertNoDbError(profiles.error ?? orders.error, "Customer order history could not be loaded.");
  const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  const summaryById = new Map();
  for (const order of orders.data ?? []) {
    if (!order.customer_id) continue;
    const summary = summaryById.get(order.customer_id) ?? { orderCount: 0, spentBdt: 0 };
    if (saleStatuses.includes(order.status)) {
      summary.orderCount += 1;
      summary.spentBdt += Number(order.total_bdt) || 0;
    }
    summaryById.set(order.customer_id, summary);
  }
  const customers = users.map((user) => {
    const profile = profileById.get(user.id);
    const summary = summaryById.get(user.id) ?? { orderCount: 0, spentBdt: 0 };
    return {
      id: user.id,
      name: profile?.full_name || user.user_metadata?.full_name || user.email || "Store customer",
      email: user.email ?? "",
      phone: profile?.phone ?? user.phone ?? "",
      orders: summary.orderCount,
      spent: Math.round(summary.spentBdt * 100),
      joined: profile?.created_at ?? user.created_at,
      status: summary.orderCount > 1 ? "Returning" : "New",
    };
  }).sort((left, right) => new Date(right.joined).getTime() - new Date(left.joined).getTime());
  send(response, 200, { customers });
}

function couponTimestamp(value, fieldName) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, `${fieldName} must be a valid date.`);
  return date.toISOString();
}

async function handleAdminCoupons(request, response, method) {
  const auth = await admin(request);
  if (method === "GET") {
    const { data, error } = await auth.service.from("coupons").select("*").order("created_at", { ascending: false });
    assertNoDbError(error, "Coupons could not be loaded.");
    send(response, 200, { coupons: data ?? [] });
    return;
  }
  const body = await readJson(request);
  if (method === "POST") {
    const code = text(body.code, "Coupon code", { min: 2, max: 32 }).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new HttpError(400, "Use only letters, numbers, hyphens, or underscores in a coupon code.");
    const discountType = body.discount_type;
    if (!["percentage", "fixed"].includes(discountType)) throw new HttpError(400, "Choose percentage or fixed discount.");
    const discountValue = money(body.discount_value, "Discount value");
    if (discountValue <= 0 || (discountType === "percentage" && discountValue > 100)) throw new HttpError(400, "Discount must be above zero and a percentage cannot exceed 100.");
    const usageLimit = body.usage_limit == null || body.usage_limit === "" ? null : Number(body.usage_limit);
    if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw new HttpError(400, "Usage limit must be a positive whole number.");
    const startsAt = couponTimestamp(body.starts_at, "Start date");
    const endsAt = couponTimestamp(body.ends_at, "End date");
    if (startsAt && endsAt && endsAt <= startsAt) throw new HttpError(400, "End date must be after the start date.");
    const record = {
      code,
      description: text(body.description ?? "", "Description", { max: 250, optional: true }) || null,
      discount_type: discountType,
      discount_value: discountValue,
      minimum_order_bdt: money(body.minimum_order_bdt ?? 0, "Minimum order"),
      usage_limit: usageLimit,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    };
    const { data, error } = await auth.service.from("coupons").insert(record).select("*").single();
    if (error?.code === "23505") throw new HttpError(409, "A coupon with that code already exists.");
    assertNoDbError(error, "The coupon could not be saved.");
    send(response, 201, { coupon: data });
    return;
  }
  if (method === "PATCH") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.is_active !== "boolean") throw new HttpError(400, "A valid coupon and active status are required.");
    const { data, error } = await auth.service.from("coupons").update({ is_active: body.is_active }).eq("id", body.id).select("id,is_active").maybeSingle();
    assertNoDbError(error, "The coupon status could not be updated.");
    if (!data) throw new HttpError(404, "Coupon not found.");
    send(response, 200, { coupon: data });
    return;
  }
  if (method === "DELETE") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new HttpError(400, "A valid coupon is required.");
    const [{ data: coupon, error: couponError }, { count: orderCount, error: orderError }] = await Promise.all([
      auth.service.from("coupons").select("id,usage_count").eq("id", body.id).maybeSingle(),
      auth.service.from("orders").select("id", { count: "exact", head: true }).eq("coupon_id", body.id),
    ]);
    assertNoDbError(couponError ?? orderError, "Coupon usage could not be checked.");
    if (!coupon) throw new HttpError(404, "Coupon not found.");
    if (coupon.usage_count || orderCount) throw new HttpError(409, "This coupon has redemption history. Deactivate it instead so order records remain intact.");
    const { error } = await auth.service.from("coupons").delete().eq("id", body.id);
    assertNoDbError(error, "The coupon could not be deleted.");
    send(response, 200, { ok: true, id: body.id });
    return;
  }
  throw new HttpError(405, "This method is not supported for coupons.");
}

async function handleAdminRewards(request, response, method) {
  const auth = await admin(request);
  if (method === "GET") {
    const [accounts, ledger, setting] = await Promise.all([
      auth.service.from("reward_accounts").select("points_balance,points_debt"),
      auth.service.from("reward_ledger").select("points_delta"),
      auth.service.from("store_settings").select("value").eq("key", "rewards").maybeSingle(),
    ]);
    assertNoDbError(accounts.error ?? ledger.error ?? setting.error, "Rewards data could not be loaded.");
    const points = ledger.data ?? [];
    const stored = setting.data?.value ?? {};
    send(response, 200, {
      settings: {
        enabled: typeof stored.enabled === "boolean" ? stored.enabled : false,
        points_per_100_bdt: Number.isInteger(stored.points_per_100_bdt) ? stored.points_per_100_bdt : 1,
        redemption_points: Number.isInteger(stored.redemption_points) ? stored.redemption_points : 100,
        redemption_value_bdt: Number.isFinite(Number(stored.redemption_value_bdt)) ? Number(stored.redemption_value_bdt) : 100,
      },
      totals: {
        memberCount: accounts.data?.length ?? 0,
        pointsBalance: (accounts.data ?? []).reduce((sum, account) => sum + Number(account.points_balance || 0), 0),
        pointsDebt: (accounts.data ?? []).reduce((sum, account) => sum + Number(account.points_debt || 0), 0),
        spendablePoints: (accounts.data ?? []).reduce((sum, account) => sum + Math.max(0, Number(account.points_balance || 0) - Number(account.points_debt || 0)), 0),
        pointsIssued: points.reduce((sum, entry) => sum + Math.max(0, Number(entry.points_delta) || 0), 0),
        pointsRedeemed: points.reduce((sum, entry) => sum + Math.abs(Math.min(0, Number(entry.points_delta) || 0)), 0),
      },
    });
    return;
  }
  const body = await readJson(request);
  const settings = body.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)
    || typeof settings.enabled !== "boolean"
    || !Number.isInteger(settings.points_per_100_bdt) || settings.points_per_100_bdt < 0 || settings.points_per_100_bdt > 1000
    || !Number.isInteger(settings.redemption_points) || settings.redemption_points < 1 || settings.redemption_points > 1_000_000
    || !Number.isFinite(settings.redemption_value_bdt) || settings.redemption_value_bdt < 0 || settings.redemption_value_bdt > 1_000_000) {
    throw new HttpError(400, "Reward settings contain invalid values.");
  }
  const { error } = await auth.service.from("store_settings").upsert({ key: "rewards", value: {
    enabled: settings.enabled,
    points_per_100_bdt: settings.points_per_100_bdt,
    redemption_points: settings.redemption_points,
    redemption_value_bdt: money(settings.redemption_value_bdt, "Redemption value"),
  } }, { onConflict: "key" });
  assertNoDbError(error, "Reward settings could not be saved.");
  send(response, 200, { ok: true });
}

async function handleAdminSettings(request, response, method) {
  const auth = await admin(request);
  if (method === "GET") {
    const { data, error } = await auth.service.from("store_settings").select("value").eq("key", "store_profile").maybeSingle();
    assertNoDbError(error, "Store settings could not be loaded.");
    const stored = data?.value ?? {};
    send(response, 200, { settings: {
      name: typeof stored.name === "string" ? stored.name : "Cloud Lamps & Mirrors",
      contact_email: typeof stored.contact_email === "string" ? stored.contact_email : "",
      phone: typeof stored.phone === "string" ? stored.phone : "",
      currency: "BDT",
      country: "Bangladesh",
    } });
    return;
  }
  const body = await readJson(request);
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) throw new HttpError(400, "Enter a store name up to 120 characters.");
  const email = text(body.contact_email ?? "", "Contact email", { max: 254, optional: true }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid contact email.");
  const phone = text(body.phone ?? "", "Store phone", { max: 40, optional: true });
  const settings = { name: body.name.trim(), contact_email: email, phone, currency: "BDT", country: "Bangladesh" };
  const { error } = await auth.service.from("store_settings").upsert({ key: "store_profile", value: settings }, { onConflict: "key" });
  assertNoDbError(error, "Store settings could not be saved.");
  send(response, 200, { ok: true, settings });
}

async function handleAdminMedia(request, response, method, url) {
  if (method === "POST") return handleImageUpload(request, response);
  const auth = await admin(request);
  const viewArchive = url.searchParams.get("view") === "archive";
  const { data: archivedRows, error: archivedError } = await auth.service.from("admin_media_archive")
    .select("object_path,archived_at").eq("bucket_id", config.storeMediaBucket);
  assertNoDbError(archivedError, "Media archive could not be loaded. Apply the latest Supabase migration and try again.");
  const archivedByPath = new Map((archivedRows ?? []).map((row) => [row.object_path, row.archived_at]));

  if (method === "PATCH" || method === "DELETE") {
    const body = await readJson(request);
    const path = typeof body.path === "string" ? body.path.trim() : "";
    const pathParts = path.split("/");
    if (!path || path.length > 1024 || path.startsWith("/") || pathParts.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f]/.test(part))) {
      throw new HttpError(400, "Choose a valid media file.");
    }
    if (method === "PATCH") {
      if (body.action !== "archive" && body.action !== "restore") throw new HttpError(400, "Choose archive or restore.");
      if (body.action === "archive") {
        const pathParts = path.split("/");
        const fileName = pathParts.pop() ?? "";
        const prefix = pathParts.join("/");
        const { data: files, error: listError } = await auth.service.storage.from(config.storeMediaBucket)
          .list(prefix, { search: fileName, limit: 100 });
        assertNoDbError(listError, "The media file could not be checked in Storage.");
        if (!(files ?? []).some((file) => file.id != null && file.name === fileName)) throw new HttpError(404, "This media file no longer exists.");
        const { error } = await auth.service.from("admin_media_archive").upsert({
          bucket_id: config.storeMediaBucket,
          object_path: path,
          archived_by_user_id: auth.user.id,
        }, { onConflict: "bucket_id,object_path" });
        assertNoDbError(error, "The media file could not be archived. Apply the latest Supabase migration and try again.");
      } else {
        const { error } = await auth.service.from("admin_media_archive")
          .delete().eq("bucket_id", config.storeMediaBucket).eq("object_path", path);
        assertNoDbError(error, "The media file could not be restored.");
      }
      send(response, 200, { ok: true });
      return;
    }

    if (!archivedByPath.has(path)) throw new HttpError(409, "Archive this media file before permanently deleting it.");
    const { error: storageError } = await auth.service.storage.from(config.storeMediaBucket).remove([path]);
    assertNoDbError(storageError, "The media file could not be removed from Storage.");
    const { error: archiveDeleteError } = await auth.service.from("admin_media_archive")
      .delete().eq("bucket_id", config.storeMediaBucket).eq("object_path", path);
    assertNoDbError(archiveDeleteError, "The file was deleted, but its archive record could not be cleared.");
    send(response, 200, { ok: true });
    return;
  }

  const media = [];
  let visited = 0;
  const visit = async (prefix = "", depth = 0) => {
    if (depth > 6 || media.length >= 500 || visited >= 5000) return;
    let offset = 0;
    while (offset < 1000 && media.length < 500 && visited < 5000) {
      const { data, error } = await auth.service.storage.from(config.storeMediaBucket)
        .list(prefix, { limit: 100, offset, sortBy: { column: "created_at", order: "desc" } });
      assertNoDbError(error, "Store images could not be listed.");
      const rows = data ?? [];
      for (const item of rows) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id == null) await visit(path, depth + 1);
        else {
          visited += 1;
          const archivedAt = archivedByPath.get(path) ?? null;
          if (Boolean(archivedAt) !== viewArchive) continue;
          const image = auth.service.storage.from(config.storeMediaBucket).getPublicUrl(path).data.publicUrl;
          media.push({ path, name: item.name, public_url: image, created_at: item.created_at ?? null, archived_at: archivedAt, metadata: item.metadata ?? null });
          if (media.length >= 500) break;
        }
      }
      if (rows.length < 100) break;
      offset += rows.length;
    }
  };
  await visit();
  send(response, 200, { media });
}

function applyRateLimit(request) {
  const forwardedFor = config.trustProxy ? request.headers["x-forwarded-for"] : null;
  const forwardedIp = typeof forwardedFor === "string" ? forwardedFor.split(",", 1)[0].trim() : "";
  const ip = forwardedIp || request.socket.remoteAddress || "unknown";
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  const method = request.method ?? "GET";
  const limits = pathname === "/api/orders" || pathname === "/api/payments/sslcommerz/init"
    ? { scope: "checkout", count: 12, windowMs: 10 * 60_000 }
    : pathname === "/api/custom-requests" && method === "POST"
      ? { scope: "custom-request", count: 8, windowMs: 10 * 60_000 }
      : pathname === "/api/reviews" && method === "POST"
        ? { scope: "review", count: 10, windowMs: 60 * 60_000 }
        : pathname === "/api/coupons/validate"
          ? { scope: "coupon", count: 30, windowMs: 60_000 }
          : pathname === "/api/payments/sslcommerz/status"
            ? { scope: "payment-status", count: 60, windowMs: 60_000 }
            : pathname.startsWith("/api/admin/")
              ? { scope: "admin", count: 120, windowMs: 60_000 }
              : { scope: "general", count: 180, windowMs: 60_000 };
  const key = `${ip}:${limits.scope}`;
  const now = Date.now();
  const existing = requestWindows.get(key);
  if (!existing || now - existing.start > limits.windowMs) requestWindows.set(key, { start: now, count: 1, windowMs: limits.windowMs });
  else {
    existing.count += 1;
    if (existing.count > limits.count) throw new HttpError(429, "Too many requests. Wait a moment and try again.");
  }
  if (requestWindows.size > 10_000) {
    for (const [entryKey, entry] of requestWindows) if (now - entry.start > entry.windowMs) requestWindows.delete(entryKey);
    while (requestWindows.size > 9_000) requestWindows.delete(requestWindows.keys().next().value);
  }
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}

function checkOrigin(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  const path = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  if (["/api/payments/sslcommerz/success", "/api/payments/sslcommerz/fail", "/api/payments/sslcommerz/cancel", "/api/payments/sslcommerz/ipn"].includes(path)) return;
  let originUrl;
  try { originUrl = new URL(origin); }
  catch { throw new HttpError(403, "This website is not allowed to call the API."); }
  const requestHost = request.headers.host?.toLowerCase();
  if (requestHost && originUrl.host.toLowerCase() === requestHost) return;
  if (!config.allowedOrigins.has(origin)) throw new HttpError(403, "This website is not allowed to call the API.");
  if (config.allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Image-Role, X-Product-Slug, X-Image-Alt");
    response.setHeader("Access-Control-Max-Age", "600");
    response.setHeader("Vary", "Origin");
  }
}

async function readSslCommerzForm(request) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("application/x-www-form-urlencoded")) throw new HttpError(415, "The payment provider sent an unsupported callback format.");
  return new URLSearchParams((await readBytes(request, 32 * 1024)).toString("utf8"));
}

async function fetchSslCommerzJson(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new HttpError(503, "The payment provider could not be reached to verify this transaction.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object") throw new HttpError(503, "The payment provider returned an unreadable verification response.");
  return data;
}

function sslCommerzValidatorUrl(path, parameters) {
  const settings = getSslCommerzSettings();
  const url = new URL(`/validator/api/${path}`, settings.gatewayHost);
  url.search = new URLSearchParams({ ...parameters, store_id: config.sslcommerzStoreId, store_passwd: config.sslcommerzStorePassword, format: "json" }).toString();
  return url;
}

async function loadSslCommerzTransaction(transactionId) {
  const url = sslCommerzValidatorUrl("merchantTransIDvalidationAPI.php", { tran_id: transactionId });
  const data = await fetchSslCommerzJson(url);
  const records = Array.isArray(data.element) ? data.element : [];
  return records.find((entry) => entry?.tran_id === transactionId) ?? null;
}

async function validateSslCommerzPayment(transactionId, valId) {
  const url = sslCommerzValidatorUrl("validationserverAPI.php", { val_id: valId });
  const validated = await fetchSslCommerzJson(url);
  const amount = Number(validated.amount);
  const risk = Number(validated.risk_level);
  if (validated.tran_id !== transactionId || !Number.isFinite(amount)
      || !["VALID", "VALIDATED"].includes(validated.status)
      || validated.currency !== "BDT" || !Number.isInteger(risk) || ![0, 1].includes(risk)) {
    return { verified: false, status: String(validated.status ?? "UNKNOWN") };
  }
  const service = getAdminDb();
  const { data, error } = await service.rpc("settle_store_payment", {
    transaction_id: transactionId,
    validation_id: String(validated.val_id ?? valId),
    validated_amount: amount,
    validated_currency: validated.currency,
    validated_status: validated.status,
    validated_risk: risk,
  });
  assertNoDbError(error, "The verified payment could not be recorded.");
  return { verified: true, status: "paid", riskReview: data?.risk_review === true };
}

async function reconcileSslCommerzPayment(transactionId, callbackValId = "") {
  if (!/^[A-Za-z0-9_-]{16,30}$/.test(transactionId)) throw new HttpError(400, "The payment transaction ID is invalid.");
  const service = getAdminDb();
  const { data: payment, error } = await service.from("payment_transactions")
    .select("status").eq("provider_transaction_id", transactionId).eq("provider", "sslcommerz").maybeSingle();
  assertNoDbError(error, "The payment record could not be loaded.");
  if (!payment) throw new HttpError(404, "The payment transaction was not found.");
  if (payment.status === "paid") return { status: "paid" };
  if (payment.status !== "pending") return { status: payment.status };

  if (callbackValId && /^[A-Za-z0-9_-]{1,50}$/.test(callbackValId)) {
    const result = await validateSslCommerzPayment(transactionId, callbackValId);
    if (result.verified) return { status: "paid", riskReview: result.riskReview };
  }

  const providerRecord = await loadSslCommerzTransaction(transactionId);
  if (!providerRecord) return { status: "pending" };
  if (["VALID", "VALIDATED"].includes(providerRecord.status) && typeof providerRecord.val_id === "string") {
    const result = await validateSslCommerzPayment(transactionId, providerRecord.val_id);
    if (result.verified) return { status: "paid", riskReview: result.riskReview };
    return { status: "pending" };
  }
  if (providerRecord.status === "FAILED") {
    const amount = Number(providerRecord.amount);
    const currency = providerRecord.currency;
    if (!Number.isFinite(amount) || currency !== "BDT") return { status: "pending" };
    const { error: closeError } = await service.rpc("close_store_payment", {
      transaction_id: transactionId,
      final_status: "failed",
      validated_amount: amount,
      validated_currency: currency,
    });
    assertNoDbError(closeError, "The failed payment could not be closed safely.");
    return { status: "failed" };
  }
  return { status: "pending" };
}

async function handleSslCommerzCallback(request, response, { ipn = false } = {}) {
  const fields = await readSslCommerzForm(request);
  const transactionId = fields.get("tran_id") ?? "";
  const valId = fields.get("val_id") ?? "";
  const result = await reconcileSslCommerzPayment(transactionId, valId);
  if (ipn) {
    send(response, 200, { received: true, status: result.status });
    return;
  }
  const siteUrl = getSslCommerzSettings().siteUrl;
  const returnUrl = new URL("/checkout", siteUrl);
  returnUrl.searchParams.set("payment", "return");
  returnUrl.searchParams.set("tran_id", transactionId);
  response.writeHead(303, { Location: returnUrl.toString(), "Cache-Control": "no-store" });
  response.end();
}

async function handlePaymentStatus(response, url) {
  const transactionId = url.searchParams.get("tran_id") ?? "";
  if (!/^[A-Za-z0-9_-]{16,30}$/.test(transactionId)) throw new HttpError(400, "The payment transaction ID is invalid.");
  const service = getAdminDb();
  const { data: payment, error: paymentError } = await service.from("payment_transactions")
    .select("status,amount_bdt,risk_level,order_id").eq("provider_transaction_id", transactionId).eq("provider", "sslcommerz").maybeSingle();
  assertNoDbError(paymentError, "The payment status could not be loaded.");
  if (!payment) throw new HttpError(404, "The payment transaction was not found.");
  const { data: order, error: orderError } = await service.from("orders")
    .select("order_number,status,payment_status").eq("id", payment.order_id).maybeSingle();
  assertNoDbError(orderError, "The order status could not be loaded.");
  send(response, 200, {
    status: payment.status,
    amountBdt: Number(payment.amount_bdt),
    orderNumber: order ? `CL-${order.order_number}` : null,
    orderStatus: order?.status ?? null,
    paymentStatus: order?.payment_status ?? null,
    riskReview: payment.risk_level === 1,
  });
}

async function route(request, response) {
  setSecurityHeaders(response);
  applyRateLimit(request);
  checkOrigin(request, response);
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";
  if (method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  if (method === "GET" && url.pathname === "/health") {
    send(response, 200, { status: "ok", service: "cloud-lamps-store-api" });
    return;
  }
  if (method === "GET" && url.pathname === "/api/catalog") return handleCatalog(response);
  if (method === "GET" && url.pathname === "/api/homepage-content") return handleHomepage(response, method, request, false);
  if (url.pathname === "/api/admin/homepage-content" && ["GET", "PATCH"].includes(method)) return handleHomepage(response, method, request, true);
  if (url.pathname === "/api/admin/categories" && ["GET", "POST", "PATCH", "DELETE"].includes(method)) return handleCategories(request, response, method);
  if (url.pathname === "/api/admin/products" && ["GET", "POST", "PATCH", "DELETE"].includes(method)) return handleAdminProducts(request, response, method, url);
  if (url.pathname === "/api/admin/media" && ["GET", "POST", "PATCH", "DELETE"].includes(method)) return handleAdminMedia(request, response, method, url);
  if (method === "GET" && url.pathname === "/api/admin/overview") return handleAdminOverview(request, response);
  if (method === "GET" && url.pathname === "/api/admin/customers") return handleAdminCustomers(request, response);
  if (url.pathname === "/api/admin/coupons" && ["GET", "POST", "PATCH", "DELETE"].includes(method)) return handleAdminCoupons(request, response, method);
  if (url.pathname === "/api/admin/rewards" && ["GET", "PATCH"].includes(method)) return handleAdminRewards(request, response, method);
  if (url.pathname === "/api/admin/settings" && ["GET", "PATCH"].includes(method)) return handleAdminSettings(request, response, method);
  if (url.pathname === "/api/reviews" && ["GET", "POST", "PATCH"].includes(method)) return handleReviews(request, response, method, url);
  if (method === "GET" && url.pathname === "/api/admin/profit") return handleProfit(request, response, url);
  if (url.pathname === "/api/customer/state" && ["GET", "PUT"].includes(method)) return handleCustomerState(request, response, method);
  if (method === "GET" && url.pathname === "/api/customer/rewards") return handleCustomerRewards(request, response);
  if (method === "POST" && url.pathname === "/api/coupons/validate") return handleCouponValidation(request, response);
  if (method === "POST" && url.pathname === "/api/orders") return handleCreateOrder(request, response);
  if (method === "POST" && url.pathname === "/api/payments/sslcommerz/init") return handleCreateOrder(request, response, { onlinePayment: true });
  if (method === "POST" && url.pathname === "/api/hooks/supabase/send-sms") return handleSupabaseSendSmsHook(request, response);
  if (method === "GET" && url.pathname === "/api/payments/sslcommerz/status") return handlePaymentStatus(response, url);
  if (method === "POST" && ["/api/payments/sslcommerz/success", "/api/payments/sslcommerz/fail", "/api/payments/sslcommerz/cancel"].includes(url.pathname)) return handleSslCommerzCallback(request, response);
  if (method === "POST" && url.pathname === "/api/payments/sslcommerz/ipn") return handleSslCommerzCallback(request, response, { ipn: true });
  if (method === "POST" && url.pathname === "/api/admin/orders/steadfast") return handleAdminSteadfast(request, response);
  if (url.pathname === "/api/admin/orders" && ["GET", "PATCH", "DELETE"].includes(method)) return handleOrders(request, response, method, url);
  if (method === "GET" && url.pathname === "/api/customer/orders") return handleCustomerOrders(request, response);
  if (method === "GET" && url.pathname === "/api/customer/custom-requests") return handleCustomerCustomRequests(request, response);
  if (method === "POST" && url.pathname === "/api/webhooks/steadfast") return handleSteadfastWebhook(request, response);
  if (url.pathname === "/api/custom-requests" && ["GET", "POST", "PATCH", "DELETE"].includes(method)) return handleCustomRequests(request, response, method, url);
  throw new HttpError(404, "This API route was not found.");
}

const server = createServer((request, response) => {
  Promise.resolve(route(request, response)).catch((error) => {
    if (response.headersSent) { response.destroy(); return; }
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("Unhandled API error:", error?.message ?? "unknown error");
    if (new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname === "/api/hooks/supabase/send-sms") {
      const message = status === 500 ? "The SMS provider could not complete this request." : error.message;
      send(response, status, { error: { http_code: status, message } });
      return;
    }
    send(response, status, { error: status === 500 ? "The server could not complete this request." : error.message });
  });
});

server.headersTimeout = 15_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 5_000;
server.listen(config.port, config.host, () => {
  console.log(`Cloud Lamps API listening on http://${config.host}:${config.port} (${process.version})`);
  console.log(hasSupabaseAuth ? "Supabase authentication is configured." : "Supabase is not connected; database routes will remain unavailable.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
