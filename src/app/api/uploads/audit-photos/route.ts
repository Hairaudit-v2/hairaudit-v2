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

export const runtime = "nodejs";

const VALID_KEYS: Record<SubmitterType, Set<string>> = {
  doctor: new Set(DOCTOR_PHOTO_SCHEMA.map((c) => c.key)),
  patient: new Set(PATIENT_PHOTO_SCHEMA.map((c) => c.key)),
};

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getMaxForKey(st: SubmitterType, key: string): number {
  const schema = st === "doctor" ? DOCTOR_PHOTO_SCHEMA : PATIENT_PHOTO_SCHEMA;
  const def = schema.find((c) => c.key === key);
  return def?.max ?? 6;
}

function getAcceptForKey(st: SubmitterType, key: string): string {
  const schema = st === "doctor" ? DOCTOR_PHOTO_SCHEMA : PATIENT_PHOTO_SCHEMA;
  const def = schema.find((c) => c.key === key);
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

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const caseId = form.get("caseId") as string | null;
    const submitterType = form.get("submitterType") as string | null;
    const category = form.get("category") as string | null;
    const files = form.getAll("files[]") as File[];

    if (!caseId)
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    if (!submitterType || !["doctor", "patient"].includes(submitterType))
      return NextResponse.json({ ok: false, error: "Missing or invalid submitterType (doctor|patient)" }, { status: 400 });
    if (!category)
      return NextResponse.json({ ok: false, error: "Missing category" }, { status: 400 });

    const st = submitterType as SubmitterType;
    const validKeys = VALID_KEYS[st];
    if (!validKeys.has(category))
      return NextResponse.json({ ok: false, error: `Invalid category for ${st}: ${category}` }, { status: 400 });

    if (!files.length)
      return NextResponse.json({ ok: false, error: "No files (use files[])" }, { status: 400 });

    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !c)
      return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });

    const canUpload =
      c.user_id === user.id ||
      c.patient_id === user.id ||
      c.doctor_id === user.id ||
      c.clinic_id === user.id;
    if (!canUpload)
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    if (c.submitted_at || c.status === "submitted")
      return NextResponse.json({ ok: false, error: "Case submitted; cannot modify" }, { status: 409 });

    const prefix = st === "doctor" ? "doctor_photo" : "patient_photo";
    const typeValue = `${prefix}:${category}`;
    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const userId = (c as { user_id?: string }).user_id ?? process.env.UPLOAD_SYSTEM_USER_ID ?? null;
    if (!userId)
      return NextResponse.json({ ok: false, error: "Case user_id or UPLOAD_SYSTEM_USER_ID required" }, { status: 400 });

    const maxFiles = getMaxForKey(st, category);
    const accepted = getAcceptForKey(st, category);
    const toUpload = files
      .filter((f) => f instanceof File && acceptsFile(f, accepted))
      .slice(0, maxFiles);
    if (!toUpload.length) {
      return NextResponse.json({ ok: false, error: "No valid files for this category" }, { status: 400 });
    }
    const saved: { id: string; type: string; storage_path: string; metadata: unknown; created_at: string }[] = [];

    for (const f of toUpload) {
      const fileName = safeName((f as File).name || "upload.jpg");
      const uuid = crypto.randomUUID();
      const ext = (fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z]/g, "jpg");
      const storagePath = `audit_photos/${caseId}/${st}/${category}/${uuid}.${ext}`;

      const arrayBuffer = await (f as File).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, buffer, {
        contentType: (f as File).type || "image/jpeg",
        upsert: false,
      });

      if (upErr)
        return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

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
            original_name: (f as File).name,
            mime: (f as File).type,
            size: (f as File).size,
          },
        })
        .select("id, type, storage_path, metadata, created_at")
        .maybeSingle();

      if (insErr)
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

      if (row) saved.push(row as any);

      try {
        await admin.from("audit_photos").insert({
          case_id: caseId,
          submitter_type: st,
          photo_key: category,
          storage_path: storagePath,
        });
      } catch {
        /* audit_photos may not exist yet */
      }
    }

    return NextResponse.json({ ok: true, savedCount: saved.length, saved });
  } catch (e: unknown) {
    console.error("audit-photos upload:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
