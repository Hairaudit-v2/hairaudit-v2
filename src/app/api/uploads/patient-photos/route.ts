// src/app/api/uploads/patient-photos/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePatientPhotoCategory } from "@/lib/photoCategories";
import { applyPatientPhotoCategoryFields } from "@/lib/uploads/patientPhotoCategoryIntegrity";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";
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
import { PATIENT_UPLOAD_CATEGORY_DEFS, type PatientUploadCategoryKey } from "@/lib/patientPhotoCategoryConfig";

export const runtime = "nodejs";

/** All valid patient upload categories (standard + extended/Stage 2) */
const ALL_PATIENT_CATEGORIES: Set<string> = new Set(PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key));

function supabaseAdmin() {
  return createSupabaseAdminClient();
}

/** Upload a single file with retry logic. */
async function uploadSingleFile(
  supabase: ReturnType<typeof supabaseAdmin>,
  bucket: string,
  caseId: string,
  userId: string,
  category: string,
  file: File
): Promise<UploadResult<{ id: string; type: string; storage_path: string; metadata: unknown; created_at: string }>> {
  const fileName = safeFileName(file.name || "upload.jpg");
  const stamp = Date.now();
  const storagePath = `cases/${caseId}/patient/${category}/${stamp}-${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to storage with retry
  const storageResult = await withRetry(
    async () => {
      const up = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (up.error) {
        return {
          success: false as const,
          error: createUploadError(
            "STORAGE_ERROR",
            up.error.message,
            { path: storagePath, storageError: up.error }
          ),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { type: patientPhotoType, metadata: patientPhotoMetadata } = applyPatientPhotoCategoryFields(
    category as any,
    {
      original_name: file.name,
      mime: file.type,
      size: file.size,
    }
  );

  const dbResult = await withRetry(
    async () => {
      const { data: row, error: insErr } = await supabase
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: patientPhotoType,
          storage_path: storagePath,
          metadata: patientPhotoMetadata,
        })
        .select("id, case_id, user_id, type, storage_path, metadata, created_at")
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
    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", requestId },
        { status: 401 }
      );
    }

    const form = await req.formData();
    const caseId = form.get("caseId") as string | null;
    const category = form.get("category") as string | null;
    const files = form.getAll("files[]") as File[];

    // Validation
    if (!caseId) {
      return NextResponse.json(
        { ok: false, error: "Missing caseId", requestId },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Missing category", requestId },
        { status: 400 }
      );
    }

  // Validate category against unified schema
    let normalizedCategory: PatientUploadCategoryKey;
    try {
      normalizedCategory = normalizePatientPhotoCategory(category);
    } catch {
      // Check if it's a valid extended category
      const trimmed = category.trim().toLowerCase();
      if (ALL_PATIENT_CATEGORIES.has(trimmed)) {
        normalizedCategory = trimmed as PatientUploadCategoryKey;
      } else {
        console.error(`[${requestId}] Invalid category:`, { category, userId: user.id });
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid upload category: ${category}`,
            requestId,
            details: { validCategories: Array.from(ALL_PATIENT_CATEGORIES).slice(0, 10) },
          },
          { status: 400 }
        );
      }
    }

    // Validate file count
    const countValidation = validateFileCount(files.length, UPLOAD_LIMITS.MAX_FILES_PER_REQUEST);
    if (!countValidation.success) {
      console.warn(`[${requestId}] File count validation failed:`, {
        count: files.length,
        error: formatUploadErrorForLog(countValidation.error),
      });
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

    const supabase = supabaseAdmin();

    // Case authorization and lock check
    const { data: c, error: caseErr } = await supabase
      .from("cases")
      .select("id, user_id, patient_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !c) {
      return NextResponse.json(
        { ok: false, error: "Case not found", caseId, requestId },
        { status: 404 }
      );
    }

    if (c.user_id !== user.id && c.patient_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Forbidden", caseId, requestId },
        { status: 403 }
      );
    }

    if (!caseSubmitSurfaceOpen({ status: c.status, submitted_at: c.submitted_at })) {
      return NextResponse.json(
        { ok: false, error: "Case submitted and cannot be modified", requestId },
        { status: 409 }
      );
    }

    const userId = (c as any)?.user_id ?? process.env.UPLOAD_SYSTEM_USER_ID ?? null;
    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "System configuration error: UPLOAD_SYSTEM_USER_ID required",
          requestId,
        },
        { status: 500 }
      );
    }

    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const saved: any[] = [];
    const errors: Array<{ file: string; error: string; code?: string }> = [];

    // Upload files sequentially with individual retry logic
    for (const [index, file] of files.entries()) {
      if (!(file instanceof File)) continue;

      console.log(`[${requestId}] Uploading file ${index + 1}/${files.length}: ${file.name}`);

      const result = await uploadSingleFile(supabase, bucket, caseId, userId, normalizedCategory, file);

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
      console.error(`[${requestId}] All uploads failed:`, { errors });
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

    // Partial success or full success
    console.log(`[${requestId}] Upload complete:`, {
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

  } catch (e: any) {
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
