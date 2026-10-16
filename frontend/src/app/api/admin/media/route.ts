import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const bucket = "store-media";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function adminService() {
  const session = await createSessionClient({ admin: true });
  if (!session) return { response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in with an administrator account." }, { status: 401 }) };
  if (user.app_metadata?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  const service = createServiceClient();
  if (!service) return { response: NextResponse.json({ error: "The server Supabase service key is not configured." }, { status: 503 }) };
  return { service, user };
}

function validObjectPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  return Boolean(path)
    && path.length <= 1024
    && !path.startsWith("/")
    && !path.split("/").some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f]/.test(part));
}

export async function GET(request: Request) {
  const { service, response } = await adminService();
  if (response) return response;
  const viewArchive = new URL(request.url).searchParams.get("view") === "archive";
  const { data: archivedRows, error: archivedError } = await service.from("admin_media_archive")
    .select("object_path,archived_at").eq("bucket_id", bucket);
  if (archivedError) return NextResponse.json({ error: "Media archive could not be loaded. Apply the latest Supabase migration and try again." }, { status: 500 });
  const archivedByPath = new Map((archivedRows ?? []).map((row) => [row.object_path, row.archived_at]));
  const media: { path: string; name: string; public_url: string; created_at: string | null; archived_at: string | null; metadata: Record<string, unknown> | null }[] = [];
  let visited = 0;

  const visit = async (prefix = "", depth = 0): Promise<string | null> => {
    if (depth > 6 || media.length >= 500 || visited >= 5000) return null;
    let offset = 0;
    while (offset < 1000 && media.length < 500 && visited < 5000) {
      const { data, error } = await service.storage.from(bucket)
        .list(prefix, { limit: 100, offset, sortBy: { column: "created_at", order: "desc" } });
      if (error) return error.message;
      const rows = data ?? [];
      for (const item of rows) {
        const path = prefix ? prefix + "/" + item.name : item.name;
        if (item.id == null) {
          const nestedError = await visit(path, depth + 1);
          if (nestedError) return nestedError;
        } else {
          visited += 1;
          const archivedAt = archivedByPath.get(path) ?? null;
          if (Boolean(archivedAt) !== viewArchive) continue;
          media.push({
            path,
            name: item.name,
            public_url: service.storage.from(bucket).getPublicUrl(path).data.publicUrl,
            created_at: item.created_at ?? null,
            archived_at: archivedAt,
            metadata: item.metadata ?? null,
          });
          if (media.length >= 500) break;
        }
      }
      if (rows.length < 100) break;
      offset += rows.length;
    }
    return null;
  };

  const listError = await visit();
  if (listError) return NextResponse.json({ error: "Store images could not be listed." }, { status: 500 });
  return NextResponse.json({ media }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const { service, user, response } = await adminService();
  if (response) return response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!validObjectPath(body.path)) return NextResponse.json({ error: "Choose a valid media file." }, { status: 400 });
  if (body.action !== "archive" && body.action !== "restore") return NextResponse.json({ error: "Choose archive or restore." }, { status: 400 });

  if (body.action === "archive") {
    const path = body.path.trim();
    const parts = path.split("/");
    const fileName = parts.pop() ?? "";
    const prefix = parts.join("/");
    const { data: files, error: listError } = await service.storage.from(bucket)
      .list(prefix, { search: fileName, limit: 100 });
    if (listError) return NextResponse.json({ error: "The media file could not be checked in Storage." }, { status: 500 });
    if (!(files ?? []).some((file) => file.id != null && file.name === fileName)) return NextResponse.json({ error: "This media file no longer exists." }, { status: 404 });
    const { error } = await service.from("admin_media_archive").upsert({
      bucket_id: bucket,
      object_path: path,
      archived_by_user_id: user.id,
    }, { onConflict: "bucket_id,object_path" });
    if (error) return NextResponse.json({ error: "The media file could not be archived. Apply the latest Supabase migration and try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await service.from("admin_media_archive")
    .delete().eq("bucket_id", bucket).eq("object_path", body.path.trim());
  if (error) return NextResponse.json({ error: "The media file could not be restored." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { service, response } = await adminService();
  if (response) return response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!validObjectPath(body.path)) return NextResponse.json({ error: "Choose a valid media file." }, { status: 400 });
  const path = body.path.trim();
  const { data: archived, error: archiveError } = await service.from("admin_media_archive")
    .select("object_path").eq("bucket_id", bucket).eq("object_path", path).maybeSingle();
  if (archiveError) return NextResponse.json({ error: "The archive entry could not be loaded." }, { status: 500 });
  if (!archived) return NextResponse.json({ error: "Archive this media file before permanently deleting it." }, { status: 409 });
  const { error: storageError } = await service.storage.from(bucket).remove([path]);
  if (storageError) return NextResponse.json({ error: "The media file could not be removed from Storage." }, { status: 500 });
  const { error } = await service.from("admin_media_archive")
    .delete().eq("bucket_id", bucket).eq("object_path", path);
  if (error) return NextResponse.json({ error: "The file was deleted, but its archive record could not be cleared." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
