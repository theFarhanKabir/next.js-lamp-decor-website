const port = Number(process.env.PORT ?? 4000);
const maxImageBytes = Number(process.env.MAX_IMAGE_BYTES ?? 12 * 1024 * 1024);
const maxJsonBytes = Number(process.env.MAX_JSON_BYTES ?? 1024 * 1024);

export const config = Object.freeze({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 4000,
  allowedOrigins: new Set((process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean)),
  trustProxy: process.env.TRUST_PROXY === "true",
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  sslcommerzStoreId: process.env.SSLCOMMERZ_STORE_ID || "",
  sslcommerzStorePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || "",
  sslcommerzLive: process.env.SSLCOMMERZ_IS_LIVE === "true",
  steadfastApiKey: process.env.STEADFAST_API_KEY || "",
  steadfastSecretKey: process.env.STEADFAST_SECRET_KEY || "",
  steadfastWebhookToken: process.env.STEADFAST_WEBHOOK_TOKEN || "",
  steadfastApiUrl: process.env.STEADFAST_API_URL || "https://portal.packzy.com/api/v1",
  publicApiUrl: process.env.PUBLIC_API_URL || "",
  publicSiteUrl: process.env.PUBLIC_SITE_URL || "",
  storeMediaBucket: process.env.STORE_MEDIA_BUCKET ?? "store-media",
  customReferenceBucket: process.env.CUSTOM_REFERENCE_BUCKET ?? "custom-request-references",
  maxImageBytes: Number.isInteger(maxImageBytes) && maxImageBytes >= 1024 * 1024 ? maxImageBytes : 12 * 1024 * 1024,
  maxJsonBytes: Number.isInteger(maxJsonBytes) && maxJsonBytes >= 1024 ? maxJsonBytes : 1024 * 1024,
});

export const hasSupabaseAuth = Boolean(config.supabaseUrl && config.supabasePublishableKey);
export const hasSupabaseAdmin = Boolean(hasSupabaseAuth && config.supabaseServiceRoleKey);
