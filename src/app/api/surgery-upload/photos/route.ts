// POST /api/surgery-upload/photos — upload a surgery photo into a checklist slot.
// Reuses the shared `uploads` table (type 'surgery_photo:<slot>') + safeUpload utils.
// Preview/remove reuse the existing /api/uploads/signed-url and /api/uploads/delete.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import {
  isValidSurgerySlot,
  normalizeSurgerySlot,
  surgeryTypeFromSlot,
} from "@/lib/surgeryUpload/checklist";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";
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
import { validateCaseFilesRouteImage } from "@/lib/uploads/caseFilesRouteImageValidation.server";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/photos]";

/**
 * Stage 3.1: optional, client-supplied image metadata. Stored for review context
 * only — it NEVER affects access, storage paths, or validation. All fields are
 * sanitized and bounded; anything missing/invalid is simply dropped.
 */
type ClientImageMeta = {
  original_filename?: string;
  original_size_bytes?: number;
  compressed_size_bytes?: number;
  width?: number;
  height?: number;
  compression_applied?: boolean;
  quality_warning?: string;
};

function toBoundedInt(value: FormDataEntryValue | null, max: number): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.floor(n), max);
}

function parseClientImageMeta(form: FormData): ClientImageMeta {
  const meta: ClientImageMeta = {};
  const filename = form.get("originalFilename");
  if (typeof filename === "string" && filename.trim()) {
    meta.original_filename = filename.trim().slice(0, 300);
  }
  const originalSize = toBoundedInt(form.get("originalSizeBytes"), 200_000_000);
  if (originalSize !== undefined) meta.original_size_bytes = originalSize;
  const compressedSize = toBoundedInt(form.get("compressedSizeBytes"), 200_000_000);
  if (compressedSize !== undefined) meta.compressed_size_bytes = compressedSize;
  const width = toBoundedInt(form.get("width"), 100_000);
  if (width !== undefined) meta.width = width;
  const height = toBoundedInt(form.get("height"), 100_000);
  if (height !== undefined) meta.height = height;
  const compression = form.get("compressionApplied");
  if (compression === "true" || compression === "false") {
    meta.compression_applied = compression === "true";
  }
  const warning = form.get("qualityWarning");
  if (typeof warning === "string" && warning.trim()) {
    meta.quality_warning = warning.trim().slice(0, 500);
  }
  return meta;
}

/** Stage 5: marks photos added in response to a reviewer's request for more evidence. */
type AdditionalEvidenceMeta = {
  added_after_review_request: true;
  uploaded_after_review_requested_at: string;
  evidence_request_context?: string;
};

async function uploadSingleFile(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  caseId: string,
  userId: string,
  role: string,
  slot: string,
  file: File,
  clientMeta: ClientImageMeta,
  additionalEvidenceMeta: AdditionalEvidenceMeta | null
): Promise<UploadResult<{ id: string; type: string; storage_path: string; metadata: unknown; created_at: string }>> {
  const validated = await validateCaseFilesRouteImage(file);
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }
  const { buffer, normalizedMime } = validated;

  const fileName = safeFileName(file.name || "upload.jpg");
  const stamp = Date.now();
  const storagePath = `cases/${caseId}/surgery/${slot}/${stamp}-${fileName}`;

  const storageResult = await withRetry(
    async () => {
      const up = await admin.storage.from(bucket).upload(storagePath, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });
      if (up.error) {
        return {
          success: false as const,
          error: createUploadError("STORAGE_ERROR", up.error.message, {
            path: storagePath,
            storageError: up.error,
          }),
        };
      }
      return { success: true as const, data: null };
    },
    `storage upload: ${storagePath}`,
    undefined,
    { warn: console.warn, error: console.error }
  );

  if (!storageResult.success) return storageResult;

  const metadata = {
    category: slot,
    surgery_slot: slot,
    submitter_type: role,
    source: "surgery_upload_portal",
    original_name: file.name,
    mime: normalizedMime,
    size: buffer.length,
    // Stage 3.1: enhanced (best-effort) client metadata. Absent fields are omitted
    // so existing/legacy upload rows without these keys remain valid.
    ...clientMeta,
    // Stage 5: tag photos uploaded after a reviewer requested more evidence.
    ...(additionalEvidenceMeta ?? {}),
  };

  return withRetry(
    async () => {
      const { data: row, error: insErr } = await admin
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: surgeryTypeFromSlot(slot as Parameters<typeof surgeryTypeFromSlot>[0]),
          storage_path: storagePath,
          metadata,
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
      return { success: true as const, data: row as never };
    },
    `db insert: ${storagePath}`,
    undefined,
    { warn: console.warn, error: console.error }
  );
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
    }

    const actor = await resolveSurgeryUploadActor(user);
    if (!actor.allowed) {
      return NextResponse.json({ ok: false, error: "Forbidden", requestId }, { status: 403 });
    }

    const form = await req.formData();
    const caseId = form.get("caseId") as string | null;
    const slotRaw = form.get("category") as string | null;
    const files = form.getAll("files[]") as File[];

    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId", requestId }, { status: 400 });
    }
    if (!slotRaw || !isValidSurgerySlot(slotRaw)) {
      return NextResponse.json(
        { ok: false, error: `Invalid photo slot: ${slotRaw}`, requestId },
        { status: 400 }
      );
    }
    const slot = normalizeSurgerySlot(slotRaw);

    const countValidation = validateFileCount(files.length, UPLOAD_LIMITS.MAX_FILES_PER_REQUEST);
    if (!countValidation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: formatUploadErrorForUser(countValidation.error),
          code: countValidation.error.code,
          requestId,
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: c } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!c) {
      return NextResponse.json({ ok: false, error: "Case not found", requestId }, { status: 404 });
    }
    if (!(await canAccessCase(user.id, c))) {
      return NextResponse.json({ ok: false, error: "Forbidden", requestId }, { status: 403 });
    }

    // Drafts accept uploads freely. Submitted uploads are locked EXCEPT when a
    // reviewer has flagged the case as needs_more_evidence (Stage 5), in which
    // case additional photos are allowed (and tagged) but details stay locked.
    const { data: details } = await admin
      .from("surgery_upload_details")
      .select("status, evidence_review_status, evidence_request_message")
      .eq("case_id", caseId)
      .maybeSingle();
    if (!details) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case", requestId },
        { status: 404 }
      );
    }
    const isAdditionalEvidence =
      details.status === "submitted" && details.evidence_review_status === "needs_more_evidence";
    if (details.status === "submitted" && !isAdditionalEvidence) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload submitted and cannot be modified", requestId },
        { status: 409 }
      );
    }

    const additionalEvidenceMeta: AdditionalEvidenceMeta | null = isAdditionalEvidence
      ? {
          added_after_review_request: true,
          uploaded_after_review_requested_at: new Date().toISOString(),
          ...(details.evidence_request_message
            ? { evidence_request_context: String(details.evidence_request_message).slice(0, 500) }
            : {}),
        }
      : null;

    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const clientMeta = parseClientImageMeta(form);
    const saved: unknown[] = [];
    const errors: Array<{ file: string; error: string; code?: string }> = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      const result = await uploadSingleFile(
        admin,
        bucket,
        caseId,
        user.id,
        actor.role,
        slot,
        file,
        clientMeta,
        additionalEvidenceMeta
      );
      if (result.success) {
        saved.push(result.data);
      } else {
        console.error(LOG_PREFIX, `failed ${file.name}`, formatUploadErrorForLog(result.error));
        errors.push({
          file: file.name,
          error: formatUploadErrorForUser(result.error),
          code: result.error.code,
        });
      }
    }

    if (saved.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: errors[0].error, errors, requestId },
        { status: 500 }
      );
    }

    // Stage 5: record additional-evidence uploads for reviewer history.
    if (isAdditionalEvidence && saved.length > 0) {
      await logEvidenceEvent(admin, {
        caseId,
        actorId: user.id,
        eventType: "additional_evidence_uploaded",
        metadata: { slot, count: saved.length },
      });
    }

    return NextResponse.json({
      ok: true,
      savedCount: saved.length,
      saved,
      errors: errors.length > 0 ? errors : undefined,
      requestId,
    });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json(
      { ok: false, error: "Upload failed. Please try again.", requestId },
      { status: 500 }
    );
  }
}
