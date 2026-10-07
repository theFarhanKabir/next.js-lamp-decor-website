import { createClient } from "@supabase/supabase-js";

const [userId] = process.argv.slice(2);
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
  console.error("Usage: node --env-file=.env.local scripts/grant-admin.mjs <user-id>");
  process.exit(1);
}
if (!projectUrl || !serverKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the root .env.local first.");
  process.exit(1);
}

const supabase = createClient(projectUrl, serverKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { role: "admin" },
});

if (error) {
  console.error(`Could not grant admin access: ${error.message}`);
  process.exit(1);
}

console.log(`Admin access granted to ${data.user.email ?? userId}. Sign out and back in on the website to refresh the session.`);
