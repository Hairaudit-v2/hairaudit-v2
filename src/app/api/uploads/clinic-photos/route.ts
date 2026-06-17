import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CLINIC_PHOTO_CATEGORIES } from "@/lib/clinicPhotoCategories";
import { validateCaseFilesRouteImage } from "@/lib/uploads/caseFilesRouteImageValidation.server";
import {
  gateUploadCaseStoragePath,
  resolveCaseFilesBucketForRoute,
} from "@/lib/hairaudit/uploadStorage";
import { notifyHairAuditUploadCreated } from "@/lib/hairaudit/uploadEventDispatcher";

export const runtime = "nodejs";

const VALID_CATEGORIES: ReadonlySet<string> = new Set(CLINIC_PHOTO_CATEGORIES.map((c) => c.key));
const CATEGORY_MAP: ReadonlyMap<string, (typeof CLINIC_PHOTO_CATEGORIES)[number]> = new Map(
  CLINIC_PHOTO_CATEGORIES.map((c) => [c.key, c] as const)
);

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
  const requestId = crypto.randomUUID();

  try {
    const form = await req.formData();
    const caseId = form.get("caseId") as string | null;
    const category = form.get("category") as string | null;
    const files = form.getAll("files[]") as File[];

    if (!caseId || !category || !files.length) {
      return NextResponse.json(
        { ok: false, error: "Missing caseId, category, or files", requestId },
        { status: 400 }
      );
    }
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ ok: false, error: "Invalid category", requestId }, { status: 400 });
    }
    const def = CATEGORY_MAP.get(category);
    if (!def) {
      return NextResponse.json({ ok: false, error: "Invalid category", requestId }, { status: 400 });
    }
    const validFiles = files.filter((f) => f instanceof File && acceptsFile(f, def.accept)).slice(0, def.maxFiles);
    if (!validFiles.length) {
      return NextResponse.json({ ok: false, error: "No valid files for this category", requestId }, { status: 400 });
    }

    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: c } = await admin
      .from("cases")
      .select("id, user_id, doctor_id, clinic_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();
    const allowed = await canAccessCase(user.id, c);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }
    if (c?.submitted_at || c?.status === "submitted") {
      return NextResponse.json({ error: "Case already submitted", requestId }, { status: 409 });
    }

    const bucketGate = resolveCaseFilesBucketForRoute();
    if (!bucketGate.ok) {
      console.error(`[${requestId}] clinic-photos bucket resolution failed`);
      return NextResponse.json(
        { ok: false, error: bucketGate.error, requestId },
        { status: bucketGate.status }
      );
    }
    const bucket = bucketGate.bucket;

    const userId = (c as { user_id?: string }).user_id ?? user.id;
    const saved: unknown[] = [];

    for (const f of validFiles) {
      if (!(f instanceof File)) continue;
      const validated = await validateCaseFilesRouteImage(f);
      if (!validated.ok) {
        return NextResponse.json({ ok: false, error: validated.error.message, requestId }, { status: 400 });
      }
      const { buffer, normalizedMime } = validated;
      const storagePath = `cases/${caseId}/clinic/${category}/${Date.now()}-${safeName(f.name || "upload.jpg")}`;
      const pathGate = gateUploadCaseStoragePath(caseId, storagePath);
      if (!pathGate.ok) {
        console.error(`[${requestId}] clinic-photos path gate rejected`, { caseId });
        return NextResponse.json({ ok: false, error: "Invalid storage path", requestId }, { status: pathGate.status });
      }
      const normalizedPath = pathGate.normalizedPath;

      const { error: upErr } = await admin.storage.from(bucket).upload(normalizedPath, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });
      if (upErr) {
        console.error(`[${requestId}] clinic-photos storage upload failed`, { caseId });
        return NextResponse.json({ ok: false, error: "Upload failed", requestId }, { status: 500 });
      }

      const { data: row, error: insErr } = await admin
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: `clinic_photo:${category}`,
          storage_path: normalizedPath,
          metadata: { category, original_name: f.name, mime: normalizedMime, size: buffer.length },
        })
        .select("id, case_id, type, storage_path, metadata, created_at")
        .maybeSingle();

      if (insErr) {
        console.error(`[${requestId}] clinic-photos db insert failed`, { caseId });
        return NextResponse.json({ ok: false, error: "Upload failed", requestId }, { status: 500 });
      }
      if (row) {
        saved.push(row);
        notifyHairAuditUploadCreated({
          upload_id: row.id,
          case_id: caseId,
          actor_type: "clinic",
          upload_surface: "forensic_audit",
          source_case_table: "cases",
          storage_bucket: bucket,
          storage_path: normalizedPath,
          legacy_upload_type: `clinic_photo:${category}`,
          canonical_photo_category: category,
          occurred_at: row.created_at,
        });
      }
    }

    return NextResponse.json({ ok: true, savedCount: saved.length, saved, requestId });
  } catch (e: unknown) {
    console.error(`[${requestId}] clinic-photos unhandled error:`, e);
    return NextResponse.json({ ok: false, error: "Upload failed", requestId }, { status: 500 });
  }
}
