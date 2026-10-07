import { createClient } from "@supabase/supabase-js";
import { config, hasSupabaseAdmin, hasSupabaseAuth } from "./config.mjs";

let publicClient;
let serviceClient;

export function getPublicClient() {
  if (!hasSupabaseAuth) return null;
  publicClient ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return publicClient;
}

export function getUserClient(accessToken) {
  if (!hasSupabaseAuth) return null;
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function getServiceClient() {
  if (!hasSupabaseAdmin) return null;
  serviceClient ??= createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return serviceClient;
}

export async function verifyAccessToken(accessToken) {
  const client = getPublicClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireUser(request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: { status: 401, message: "Sign in to continue." } };
  if (!hasSupabaseAuth) return { error: { status: 503, message: "Authentication is not connected yet." } };
  const user = await verifyAccessToken(token);
  if (!user) return { error: { status: 401, message: "Your session is invalid or has expired. Sign in again." } };
  return { user, client: getUserClient(token) };
}

export async function requireAdmin(request) {
  const authentication = await requireUser(request);
  if (authentication.error) return authentication;
  if (authentication.user.app_metadata?.role !== "admin") {
    return { error: { status: 403, message: "Administrator access is required." } };
  }
  const service = getServiceClient();
  if (!service) return { error: { status: 503, message: "The Supabase server key is not connected yet." } };
  return { ...authentication, service };
}
