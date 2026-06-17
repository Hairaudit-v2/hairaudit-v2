/**
 * Legacy doctor upload API. Canonical flow: use POST /api/uploads/audit-photos with
 * submitterType=doctor and category=img_* keys (see auditPhotoSchemas / photoSchemas).
 *
 * Phase 2C: blocked in production (410 Gone). Dev/test retain hardened handler for
 * backward compatibility with legacy integrations.
 */
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DOCTOR_PHOTO_CATEGORIES } from "@/lib/doctorPhotoCategories";
import { validateCaseFilesRouteImage } from "@/lib/uploads/caseFilesRouteImageValidation.server";
import {
  gateUploadCaseStoragePath,
  resolveCaseFilesBucketForRoute,
} from "@/lib/hairaudit/uploadStorage";

export const runtime = "nodejs";

const DEPRECATED_MIGRATION =
  "Use POST /api/uploads/audit-photos with submitterType=doctor and category (img_*) instead.";

const VALID_CATEGORIES: ReadonlySet<string> = new Set(DOCTOR_PHOTO_CATEGORIES.map((c) => c.key));
const CATEGORY_MAP: ReadonlyMap<string, (typeof DOCTOR_PHOTO_CATEGORIES)[number]> = new Map(
  DOCTOR_PHOTO_CATEGORIES.map((c) => [c.key, c] as const)
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
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "This upload endpoint is deprecated.", migration: DEPRECATED_MIGRATION },
      { status: 410, headers: { "X-Deprecated": DEPRECATED_MIGRATION } }
    );
  }

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

    const bucketGate = resolveCaseFilesBucketForRoute();
    if (!bucketGate.ok) {
      console.error("[uploads/doctor-photos] Bucket resolution failed");
      return NextResponse.json({ ok: false, error: bucketGate.error }, { status: bucketGate.status });
    }

    const userId = (c as { user_id?: string }).user_id ?? user.id;
    const bucket = bucketGate.bucket;
    const saved: unknown[] = [];

    for (const f of validFiles) {
      if (!(f instanceof File)) continue;
      const validated = await validateCaseFilesRouteImage(f);
      if (!validated.ok) {
        return NextResponse.json({ ok: false, error: validated.error.message }, { status: 400 });
      }
      const { buffer, normalizedMime } = validated;
      const storagePath = `cases/${caseId}/doctor/${category}/${Date.now()}-${safeName(f.name || "upload.jpg")}`;
      const pathGate = gateUploadCaseStoragePath(caseId, storagePath);
      if (!pathGate.ok) {
        return NextResponse.json({ ok: false, error: "Invalid storage path" }, { status: pathGate.status });
      }

      const { error: upErr } = await admin.storage.from(bucket).upload(pathGate.normalizedPath, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });
      if (upErr) {
        console.error("[uploads/doctor-photos] Storage upload failed:", upErr.message);
        return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
      }

      const { data: row, error: insErr } = await admin
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: `doctor_photo:${category}`,
          storage_path: pathGate.normalizedPath,
          metadata: { category, original_name: f.name, mime: normalizedMime, size: buffer.length },
        })
        .select("id, case_id, type, storage_path, metadata, created_at")
        .maybeSingle();

      if (insErr) {
        console.error("[uploads/doctor-photos] DB insert failed:", insErr.message);
        return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
      }
      if (row) saved.push(row);
    }

    const res = NextResponse.json({ ok: true, savedCount: saved.length, saved });
    res.headers.set("X-Deprecated", DEPRECATED_MIGRATION);
    return res;
  } catch (e: unknown) {
    console.error("[uploads/doctor-photos] Error:", e);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
