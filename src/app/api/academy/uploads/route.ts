import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { normalizeAcademyPhotoCategoryInput, trainingPhotoType } from "@/lib/academy/photoCategories";
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

function admin() {
  return createSupabaseAdminClient();
}

async function uploadOne(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  caseId: string,
  userId: string,
  category: string,
  file: File
): Promise<
  UploadResult<{
    id: string;
    training_case_id: string;
    uploaded_by: string;
    type: string;
    storage_path: string;
    metadata_json: Record<string, unknown>;
    created_at: string;
  }>
> {
  const fileName = safeFileName(file.name || "upload.jpg");
  const stamp = Date.now();
  const storagePath = `academy/training-cases/${caseId}/${category}/${stamp}-${fileName}`;
  const uploadType = trainingPhotoType(category as Parameters<typeof trainingPhotoType>[0]);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const storageResult = await withRetry(
    async () => {
      const up = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) {
        return {
          success: false as const,
          error: createUploadError("STORAGE_ERROR", up.error.message, { path: storagePath }),
        };
      }
      return { success: true as const, data: null };
    },
    `academy storage: ${storagePath}`,
    undefined,
    { warn: console.warn, error: console.error }
  );

  if (!storageResult.success) return storageResult;

  const metadata_json = {
    original_name: file.name,
    mime: file.type,
    size: file.size,
    category,
  };

  const dbResult = await withRetry(
    async () => {
      const { data: row, error: insErr } = await supabase
        .from("training_case_uploads")
        .insert({
          training_case_id: caseId,
          uploaded_by: userId,
          type: uploadType,
          storage_path: storagePath,
          metadata_json,
        })
        .select("id, training_case_id, uploaded_by, type, storage_path, metadata_json, created_at")
        .maybeSingle();

      if (insErr) {
        return {
          success: false as const,
          error: createUploadError("DB_ERROR", insErr.message, { dbError: insErr }),
        };
      }
      if (!row) {
        return { success: false as const, error: createUploadError("DB_ERROR", "Insert failed") };
      }
      return { success: true as const, data: row as any };
    },
    `academy upload db: ${storagePath}`,
    undefined,
    { warn: console.warn, error: console.error }
  );

  return dbResult;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
  }

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
  }

  const form = await req.formData();
  const caseId = form.get("caseId") as string | null;
  const categoryRaw = form.get("category") as string | null;
  const files = form.getAll("files[]") as File[];

  if (!caseId?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing caseId", requestId }, { status: 400 });
  }
  if (!categoryRaw?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing category", requestId }, { status: 400 });
  }

  const category = normalizeAcademyPhotoCategoryInput(categoryRaw);
  if (!category) {
    return NextResponse.json({ ok: false, error: "Invalid category", requestId }, { status: 400 });
  }

  const countValidation = validateFileCount(files.length, UPLOAD_LIMITS.MAX_FILES_PER_REQUEST);
  if (!countValidation.success) {
    return NextResponse.json(
      {
        ok: false,
        error: formatUploadErrorForUser(countValidation.error),
        requestId,
      },
      { status: 400 }
    );
  }

  const { data: canRead } = await auth.from("training_cases").select("id").eq("id", caseId.trim()).maybeSingle();
  if (!canRead) {
    return NextResponse.json({ ok: false, error: "Forbidden", requestId }, { status: 403 });
  }

  const supabase = admin();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const file = files[0];
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file", requestId }, { status: 400 });
  }

  const result = await uploadOne(supabase, bucket, caseId.trim(), user.id, category, file);
  if (!result.success) {
    console.error(`[${requestId}] Academy upload failed`, formatUploadErrorForLog(result.error));
    return NextResponse.json(
      { ok: false, error: formatUploadErrorForUser(result.error), requestId },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved: result.data, requestId });
}
