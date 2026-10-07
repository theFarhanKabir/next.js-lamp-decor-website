import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { config, hasSupabaseAdmin, hasSupabaseAuth } from "./config.mjs";
import { uploadOptimizedImage, optimizeImage } from "./images.mjs";
import { getPublicClient, getServiceClient, requireAdmin, requireUser, verifyAccessToken } from "./supabase.mjs";
import { HttpError, imageHttpUrl, money, objectBody, slugify, text } from "./validation.mjs";

const requestWindows = new Map();
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

function productView(row) {
  const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const primary = images.find((image) => image.image_role === "product") ?? images[0];
  const lifestyle = images.find((image) => image.image_role === "lifestyle") ?? images[1] ?? primary;
  const attrs = row.attributes ?? {};
  const publicPrice = Number(row.price_bdt);
  const comparePrice = row.compare_at_price_bdt == null ? null : Number(row.compare_at_price_bdt);
  return {
    id: row.slug,
    name: row.name,
    category: row.category?.name === "Lamps" ? "Lighting" : row.category?.name ?? "Lighting",
    subcategory: row.subcategory?.name ?? row.category?.name ?? "",
    description: row.description || row.short_description || "",
    badge: comparePrice ? "sale" : attrs.special_edition ? "new" : attrs.badge,
    basePrice: Math.round((comparePrice ?? publicPrice) * 100),
    salePrice: comparePrice ? Math.round(publicPrice * 100) : undefined,
    rating: attrs.rating,
    reviewCount: attrs.reviewCount,
    swatches: row.swatches ?? [],
    images: { silo: primary?.public_url ?? attrs.imageUrl ?? "", lifestyle: lifestyle?.public_url ?? primary?.public_url ?? "" },
    gallery: images.map((image) => image.public_url),
    galleryDetails: images.map((image) => ({ url: image.public_url, alt: image.alt_text ?? row.name, role: image.image_role, variants: image.image_variants ?? [] })),
    sizes: (attrs.sizes ?? []).map((option) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
    fabrics: (attrs.fabrics ?? []).map((option) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
    legs: (attrs.legs ?? []).map((option) => ({ ...option, delta: Math.round(Number(option.delta ?? 0) * 100) })),
    materials: attrs.materials ?? [],
    dimensions: attrs.dimensions ?? "",
    orderType: row.made_to_order ? "made-to-order" : "in-stock",
    leadTime: row.lead_time ?? undefined,
  };
}

async function getProductRows(client, { slug, activeOnly = false } = {}) {
  let query = client.from("products")
    .select("*, category:categories!products_category_id_fkey(name,slug), subcategory:categories!products_subcategory_id_category_id_fkey(name,slug), product_images(public_url,storage_path,image_variants,alt_text,image_role,sort_order)")
    .order("sort_order", { ascending: true });
  if (slug) query = query.eq("slug", slug);
  if (activeOnly) query = query.eq("status", "active");
  const { data, error } = await query;
  assertNoDbError(error, "The product catalogue could not be loaded. Apply the backend migrations and try again.");
  return data ?? [];
}

async function handleCatalog(response) {
  const products = await getProductRows(getPublicDb(), { activeOnly: true });
  send(response, 200, { products: products.map(productView), source: "supabase" });
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
  throw new HttpError(405, "This method is not supported for products.");
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
      send(response, 200, { content: data?.value ?? null, source: data?.value ? "supabase" : "unset" });
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
  send(response, 200, { content: data?.value ?? null, source: data?.value ? "supabase" : "unset" });
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
    const { data, error } = await getPublicDb().from("reviews")
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
    const { data: product } = await auth.client.from("products").select("id").eq("slug", slug).maybeSingle();
    const customerName = text(auth.user.user_metadata?.full_name ?? auth.user.email?.split("@")[0] ?? "Customer", "Customer name", { min: 1, max: 120 });
    const { error } = await auth.client.from("reviews").insert({
      product_id: product?.id ?? null, product_slug: slug, customer_id: auth.user.id,
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

async function handleCreateOrder(request, response) {
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
  const paymentMethod = ["card", "bkash", "cod"].includes(body.paymentMethod) ? body.paymentMethod : "";
  if (!deliveryMethod || !paymentMethod) throw new HttpError(400, "Choose a valid delivery and payment method.");
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) throw new HttpError(400, "Your order must contain between 1 and 30 items.");

  let customerId = null;
  const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (accessToken) {
    const user = await verifyAccessToken(accessToken);
    if (!user) throw new HttpError(401, "Your customer session is invalid or has expired.");
    customerId = user.id;
  }

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
  const order = {
    customer_id: customerId, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone,
    status: "pending", payment_status: "pending", payment_method: paymentMethod,
    shipping_address: { address, city, postalCode, country: "Bangladesh", deliveryMethod },
    subtotal_bdt: subtotal, delivery_fee_bdt: deliveryFee, discount_bdt: 0, total_bdt: subtotal + deliveryFee,
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
    assertNoDbError(orderError, "Your order could not be created.");
  }
  if (!saved || typeof saved.id !== "string" || saved.order_number == null) {
    throw new HttpError(502, "The order could not be confirmed. Please contact support before retrying.");
  }
  send(response, 201, { success: true, orderId: saved.id, orderNumber: `CL-${saved.order_number}`, total: order.total_bdt, status: order.status });
}

async function handleOrders(request, response, method, url) {
  const auth = await admin(request);
  if (method === "GET") {
    let query = auth.service.from("orders")
      .select("*,order_items(id,product_name,product_sku,quantity,unit_price_bdt,line_total_bdt,selected_options)")
      .order("placed_at", { ascending: false }).limit(100);
    const status = url.searchParams.get("status");
    if (status && orderStatuses.has(status)) query = query.eq("status", status);
    const { data, error } = await query;
    assertNoDbError(error, "Could not load orders.");
    send(response, 200, { orders: data ?? [] });
    return;
  }
  if (method === "PATCH") {
    const body = await readJson(request);
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || !orderStatuses.has(body.status)) throw new HttpError(400, "Choose a valid order and status.");
    const update = { status: body.status, updated_at: new Date().toISOString() };
    if (body.admin_note != null) update.admin_note = text(body.admin_note, "Admin note", { max: 4000 });
    const { error } = await auth.service.from("orders").update(update).eq("id", body.id);
    assertNoDbError(error, "The order could not be updated.");
    send(response, 200, { ok: true });
    return;
  }
  throw new HttpError(405, "This method is not supported for orders.");
}

async function handleCustomRequests(request, response, method, url) {
  if (method === "GET") {
    const auth = await admin(request);
    const { data, error } = await auth.service.from("custom_requests")
      .select("id,request_number,full_name,phone,email,city_area,delivery_address,description,status,created_at,custom_request_images(id,file_name,storage_path,sort_order)")
      .order("created_at", { ascending: false });
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
  if (method !== "POST") throw new HttpError(405, "This method is not supported for custom requests.");
  const service = getAdminDb();
  const contentType = String(request.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("multipart/form-data")) throw new HttpError(415, "Submit the custom request as a multipart form.");
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
  const { data: saved, error: saveError } = await service.from("custom_requests").insert({ full_name: fullName, phone, email: email || null, city_area: cityArea, delivery_address: deliveryAddress, description }).select("id,request_number").single();
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

function applyRateLimit(request) {
  const ip = request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const existing = requestWindows.get(ip);
  if (!existing || now - existing.start > 60_000) requestWindows.set(ip, { start: now, count: 1 });
  else {
    existing.count += 1;
    if (existing.count > 180) throw new HttpError(429, "Too many requests. Wait a moment and try again.");
  }
  if (requestWindows.size > 2000) {
    for (const [key, entry] of requestWindows) if (now - entry.start > 60_000) requestWindows.delete(key);
  }
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
}

function checkOrigin(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!config.allowedOrigins.has(origin)) throw new HttpError(403, "This website is not allowed to call the API.");
  if (config.allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Image-Role, X-Product-Slug, X-Image-Alt");
    response.setHeader("Access-Control-Max-Age", "600");
    response.setHeader("Vary", "Origin");
  }
}

async function route(request, response) {
  setSecurityHeaders(response);
  applyRateLimit(request);
  checkOrigin(request, response);
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";
  if (method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  if (method === "GET" && url.pathname === "/health") {
    send(response, 200, { status: "ok", service: "cloud-lamps-store-api", node: process.version, supabase: hasSupabaseAuth ? hasSupabaseAdmin ? "configured" : "missing-server-key" : "not-connected" });
    return;
  }
  if (method === "GET" && url.pathname === "/api/catalog") return handleCatalog(response);
  if (method === "GET" && url.pathname === "/api/homepage-content") return handleHomepage(response, method, request, false);
  if (url.pathname === "/api/admin/homepage-content" && ["GET", "PATCH"].includes(method)) return handleHomepage(response, method, request, true);
  if (url.pathname === "/api/admin/products" && ["GET", "POST", "PATCH"].includes(method)) return handleAdminProducts(request, response, method, url);
  if (method === "POST" && url.pathname === "/api/admin/media") return handleImageUpload(request, response);
  if (url.pathname === "/api/reviews" && ["GET", "POST", "PATCH"].includes(method)) return handleReviews(request, response, method, url);
  if (method === "GET" && url.pathname === "/api/admin/profit") return handleProfit(request, response, url);
  if (method === "POST" && url.pathname === "/api/orders") return handleCreateOrder(request, response);
  if (url.pathname === "/api/admin/orders" && ["GET", "PATCH"].includes(method)) return handleOrders(request, response, method, url);
  if (url.pathname === "/api/custom-requests" && ["GET", "POST"].includes(method)) return handleCustomRequests(request, response, method, url);
  throw new HttpError(404, "This API route was not found.");
}

const server = createServer((request, response) => {
  Promise.resolve(route(request, response)).catch((error) => {
    if (response.headersSent) { response.destroy(); return; }
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("Unhandled API error:", error?.message ?? "unknown error");
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
