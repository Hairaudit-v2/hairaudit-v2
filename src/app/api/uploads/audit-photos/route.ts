// POST: Upload photos for audit evidence (dual schema: doctor / patient)
// Writes to uploads (backward compat) and audit_photos
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import {
  SubmitterType,
  DOCTOR_PHOTO_SCHEMA,
  PATIENT_PHOTO_SCHEMA,
} from "@/lib/auditPhotoSchemas";
import { PATIENT_UPLOAD_CATEGORY_DEFS } from "@/lib/patientPhotoCategoryConfig";
import {
  UPLOAD_LIMITS,
  validateFileCount,
  safeFileName,
  withRetry,
  createUploadError,
  formatUploadErrorForUser,
  formatUploadErrorForLog,
  type UploadResult,
} from "@/lib/uploads/safeUpload";

export const runtime = "nodejs";

/** Unified patient categories: includes both schema (legacy buckets) and all extended (Stage 2) categories */
const PATIENT_AUDIT_PHOTO_KEYS = new Set([
  ...PATIENT_PHOTO_SCHEMA.map((c) => c.key),
  ...PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key),
]);

/** Verify all patient categories are present (sanity check) */
if (PATIENT_UPLOAD_CATEGORY_DEFS.length !== PATIENT_AUDIT_PHOTO_KEYS.size) {
  console.warn("Category set mismatch:", {
    defs: PATIENT_UPLOAD_CATEGORY_DEFS.length,
    keys: PATIENT_AUDIT_PHOTO_KEYS.size,
    missing: PATIENT_UPLOAD_CATEGORY_DEFS.filter(d => !PATIENT_PHOTO_SCHEMA.some(s => s.key === d.key)).map(d => d.key),
  });
}

const VALID_KEYS: Record<SubmitterType, Set<string>> = {
  doctor: new Set(DOCTOR_PHOTO_SCHEMA.map((c) => c.key)),
  patient: PATIENT_AUDIT_PHOTO_KEYS,
  clinic: new Set(DOCTOR_PHOTO_SCHEMA.map((c) => c.key)),
};

function getMaxForKey(st: SubmitterType, key: string): number {
  if (st === "patient") {
    // Check extended defs first (includes all categories including Stage 2)
    const fromUpload = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === key);
    if (fromUpload) return fromUpload.maxFiles;
    // Fall back to schema
    const fromSchema = PATIENT_PHOTO_SCHEMA.find((c) => c.key === key);
    if (fromSchema) return fromSchema.max;
    return 6;
  }
  const def = DOCTOR_PHOTO_SCHEMA.find((c) => c.key === key);
  return def?.max ?? 6;
}

function getAcceptForKey(st: SubmitterType, key: string): string {
  if (st === "patient") {
    const fromUpload = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === key);
    if (fromUpload) return fromUpload.accept;
    const fromSchema = PATIENT_PHOTO_SCHEMA.find((c) => c.key === key);
    if (fromSchema?.accept) return fromSchema.accept;
    return "image/*";
  }
  const def = DOCTOR_PHOTO_SCHEMA.find((c) => c.key === key);
  return def?.accept ?? "image/*";
}

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

/** Upload a single file with retry logic. */
async function uploadSingleFile(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  caseId: string,
  userId: string,
  st: SubmitterType,
  category: string,
  typeValue: string,
  file: File
): Promise<UploadResult<{ id: string; type: string; storage_path: string; metadata: unknown; created_at: string }>> {
  const fileName = safeFileName(file.name || "upload.jpg");
  const uuid = crypto.randomUUID();
  const ext = (fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z]/g, "jpg");
  const storagePath = `audit_photos/${caseId}/${st}/${category}/${uuid}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to storage with retry
  const storageResult = await withRetry(
    async () => {
      const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

      if (upErr) {
        return {
          success: false as const,
          error: createUploadError("STORAGE_ERROR", upErr.message, { storageError: upErr }),
        };
      }
      return { success: true as const, data: null };
    },
    `storage upload: ${storagePath}`,
    undefined,
    { warn: console.warn, error: console.error }
  );

  if (!storageResult.success) {
    return storageResult;
  }

  // Insert DB record with retry
  const dbResult = await withRetry(
    async () => {
      const { data: row, error: insErr } = await admin
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: typeValue,
          storage_path: storagePath,
          metadata: {
            category,
            submitter_type: st,
            original_name: file.name,
            mime: file.type,
            size: file.size,
          },
        })
        .select("id, type, storage_path, metadata, created_at")
        .maybeSingle();

      if (insErr) {
        return {
          success: false as const,
          error: createUploadError("DB_ERROR", insErr.message, { dbError: insErr }),
        };
      }

      if (!row) {
        return {
          success: false as const,
          error: createUploadError("DB_ERROR", "Failed to insert upload record"),
        };
      }

      // Best-effort audit_photos insert (may not exist yet)
      try {
        await admin.from("audit_photos").insert({
          case_id: caseId,
          submitter_type: st,
          photo_key: category,
          storage_path: storagePath,
        });
      } catch {
        // Silently ignore - audit_photos may not exist
      }

      return { success: true as const, data: row as any };
    },
    `db insert: ${storagePath}`,
    undefined,
    { warn: console.warn, error: console.error }
  );

  return dbResult;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const form = await req.formData();
    const caseId = form.get("caseId") as string | null;
    const submitterType = form.get("submitterType") as string | null;
    const category = form.get("category") as string | null;
    const files = form.getAll("files[]") as File[];

    // Validation
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId", requestId }, { status: 400 });
    }

    if (!submitterType || !["doctor", "patient", "clinic"].includes(submitterType)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid submitterType (doctor|patient|clinic)", requestId },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json({ ok: false, error: "Missing category", requestId }, { status: 400 });
    }

    const st = submitterType as SubmitterType;

    // Category validation
    const validKeys = VALID_KEYS[st];
    if (!validKeys.has(category)) {
      console.error(`[${requestId}] Invalid category for ${st}:`, {
        category,
        validCategories: st === "patient" ? Array.from(validKeys).slice(0, 20) : undefined,
      });
      return NextResponse.json(
        { ok: false, error: `Invalid category for ${st}: ${category}`, requestId },
        { status: 400 }
      );
    }

    // File count validation
    const countValidation = validateFileCount(files.length, UPLOAD_LIMITS.MAX_FILES_PER_REQUEST);
    if (!countValidation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: formatUploadErrorForUser(countValidation.error),
          requestId,
          code: countValidation.error.code,
        },
        { status: 400 }
      );
    }

    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Case authorization and lock check
    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !c) {
      return NextResponse.json({ ok: false, error: "Case not found", requestId }, { status: 404 });
    }

    const canUpload =
      c.user_id === user.id ||
      c.patient_id === user.id ||
      c.doctor_id === user.id ||
      c.clinic_id === user.id;
    if (!canUpload) {
      return NextResponse.json({ ok: false, error: "Forbidden", requestId }, { status: 403 });
    }

    if (c.submitted_at || c.status === "submitted") {
      return NextResponse.json({ ok: false, error: "Case submitted; cannot modify", requestId }, { status: 409 });
    }

    const prefix = st === "doctor" ? "doctor_photo" : "patient_photo";
    const typeValue = `${prefix}:${category}`;
    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const userId = (c as { user_id?: string }).user_id ?? process.env.UPLOAD_SYSTEM_USER_ID ?? null;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Case user_id or UPLOAD_SYSTEM_USER_ID required", requestId },
        { status: 500 }
      );
    }

    // Get limits and filter files
    const maxFiles = getMaxForKey(st, category);
    const accepted = getAcceptForKey(st, category);

    // Filter and validate each file
    const toUpload = files.filter((f) => {
      if (!(f instanceof File)) return false;
      if (!acceptsFile(f, accepted)) {
        console.warn(`[${requestId}] Rejected file: ${f.name} (type: ${f.type})`);
        return false;
      }
      return true;
    });

    if (!toUpload.length) {
      return NextResponse.json(
        { ok: false, error: "No valid files for this category", requestId },
        { status: 400 }
      );
    }

    // Apply per-category max limit (after validation)
    const finalFiles = toUpload.slice(0, maxFiles);

    const saved: { id: string; type: string; storage_path: string; metadata: unknown; created_at: string }[] = [];
    const errors: Array<{ file: string; error: string; code?: string }> = [];

    // Upload files sequentially with retry
    for (const [index, file] of finalFiles.entries()) {
      console.log(`[${requestId}] Uploading ${st}/${category} file ${index + 1}/${finalFiles.length}: ${file.name}`);

      const result = await uploadSingleFile(admin, bucket, caseId, userId, st, category, typeValue, file);

      if (result.success) {
        saved.push(result.data);
      } else {
        console.error(`[${requestId}] Failed to upload ${file.name}:`, formatUploadErrorForLog(result.error));
        errors.push({
          file: file.name,
          error: formatUploadErrorForUser(result.error),
          code: result.error.code,
        });
      }
    }

    const duration = Date.now() - startTime;

    // If all failed, return error
    if (saved.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: errors[0].error,
          requestId,
          errors,
          durationMs: duration,
        },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] Upload complete:`, {
      st,
      category,
      saved: saved.length,
      errors: errors.length,
      durationMs: duration,
    });

    return NextResponse.json({
      ok: true,
      savedCount: saved.length,
      saved,
      errors: errors.length > 0 ? errors : undefined,
      requestId,
      durationMs: duration,
    });

  } catch (e: unknown) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Unhandled upload error:`, e);
    return NextResponse.json(
      {
        ok: false,
        error: "Upload failed. Please try again.",
        requestId,
        durationMs: duration,
      },
      { status: 500 }
    );
  }
}
