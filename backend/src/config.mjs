const port = Number(process.env.PORT ?? 4000);
const maxImageBytes = Number(process.env.MAX_IMAGE_BYTES ?? 12 * 1024 * 1024);
const maxJsonBytes = Number(process.env.MAX_JSON_BYTES ?? 1024 * 1024);

export const config = Object.freeze({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 4000,
  allowedOrigins: new Set((process.env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  storeMediaBucket: process.env.STORE_MEDIA_BUCKET ?? "store-media",
  customReferenceBucket: process.env.CUSTOM_REFERENCE_BUCKET ?? "custom-request-references",
  maxImageBytes: Number.isInteger(maxImageBytes) && maxImageBytes >= 1024 * 1024 ? maxImageBytes : 12 * 1024 * 1024,
  maxJsonBytes: Number.isInteger(maxJsonBytes) && maxJsonBytes >= 1024 ? maxJsonBytes : 1024 * 1024,
});

export const hasSupabaseAuth = Boolean(config.supabaseUrl && config.supabasePublishableKey);
export const hasSupabaseAdmin = Boolean(hasSupabaseAuth && config.supabaseServiceRoleKey);
