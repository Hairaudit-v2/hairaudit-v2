import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CLINIC_PHOTO_CATEGORIES } from "@/lib/clinicPhotoCategories";

export const runtime = "nodejs";

const VALID_CATEGORIES = new Set(CLINIC_PHOTO_CATEGORIES.map((c) => c.key));
const CATEGORY_MAP = new Map(CLINIC_PHOTO_CATEGORIES.map((c) => [c.key, c] as const));

function acceptsFile(file: File, accept: string): boolean {
  if (!accept || accept === "*/*") return true;
  const mime = (file.type || "").toLowerCase();
  const dotExt = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return tokens.some((token) => {
    if (token === "*/*") return true;
    if (token.endsWith("/*")) return mime.startsWith(token.slice(0, -1));
    if (token.startsWith(".")) return dotExt === token;
    return mime === token;
  });
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const caseId = form.get("caseId") as string | null;
    const category = form.get("category") as string | null;
    const files = form.getAll("files[]") as File[];

    if (!caseId || !category || !files.length) {
      return NextResponse.json({ ok: false, error: "Missing caseId, category, or files" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
    }
    const def = CATEGORY_MAP.get(category);
    if (!def) {
      return NextResponse.json({ ok: false, error: "Category config not found" }, { status: 400 });
    }
    const validFiles = files.filter((f) => f instanceof File && acceptsFile(f, def.accept)).slice(0, def.maxFiles);
    if (!validFiles.length) {
      return NextResponse.json({ ok: false, error: "No valid files for this category" }, { status: 400 });
    }

    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: c } = await admin.from("cases").select("id, user_id, doctor_id, clinic_id, status, submitted_at").eq("id", caseId).maybeSingle();
    const allowed = await canAccessCase(user.id, c);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (c?.submitted_at || c?.status === "submitted") {
      return NextResponse.json({ error: "Case already submitted" }, { status: 409 });
    }

    const userId = (c as { user_id?: string }).user_id ?? user.id;
    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const saved: unknown[] = [];

    for (const f of validFiles) {
      if (!(f instanceof File)) continue;
      const storagePath = `cases/${caseId}/clinic/${category}/${Date.now()}-${safeName(f.name || "upload.jpg")}`;
      const buffer = Buffer.from(await f.arrayBuffer());

      const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, buffer, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

      const { data: row, error: insErr } = await admin
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: `clinic_photo:${category}`,
          storage_path: storagePath,
          metadata: { category, original_name: f.name, mime: f.type, size: f.size },
        })
        .select("id, case_id, type, storage_path, metadata, created_at")
        .maybeSingle();

      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      if (row) saved.push(row);
    }

    return NextResponse.json({ ok: true, savedCount: saved.length, saved });
  } catch (e: unknown) {
    console.error("clinic-photos:", e);
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? "Server error" }, { status: 500 });
  }
}
