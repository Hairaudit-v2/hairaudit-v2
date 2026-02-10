// src/app/api/uploads/patient-photos/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePatientPhotoCategory } from "@/lib/photoCategories";

export const runtime = "nodejs"; // we use Buffer

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
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

    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ ok: false, error: "Missing category" }, { status: 400 });
    }

    let normalizedCategory: string;
    try {
      normalizedCategory = normalizePatientPhotoCategory(category);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid category", category }, { status: 400 });
    }

    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: "No files uploaded (field name must be 'files[]')" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // ✅ Ensure case exists + read lock fields
    const { data: c, error: caseErr } = await supabase
      .from("cases")
      .select("id, user_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr || !c) {
      return NextResponse.json({ ok: false, error: "Case not found", caseId }, { status: 404 });
    }

    // ✅ Lock after submit
    if (c.submitted_at || c.status === "submitted") {
      return NextResponse.json(
        { ok: false, error: "This case has been submitted and cannot be modified." },
        { status: 409 }
      );
    }

    // uploads.user_id is NOT NULL → must supply it
    const userId = (c as any)?.user_id ?? process.env.UPLOAD_SYSTEM_USER_ID ?? null;
    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "uploads.user_id is required. Set cases.user_id OR set UPLOAD_SYSTEM_USER_ID env var.",
        },
        { status: 400 }
      );
    }

    const bucket = process.env.CASE_FILES_BUCKET || "case-files";
    const saved: any[] = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;

      const fileName = safeName(f.name || "upload.jpg");
      const stamp = Date.now();
      const storagePath = `cases/${caseId}/patient/${normalizedCategory}/${stamp}-${fileName}`;

      const arrayBuffer = await f.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const up = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });

      if (up.error) {
        return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
      }

      const { data: row, error: insErr } = await supabase
        .from("uploads")
        .insert({
          case_id: caseId,
          user_id: userId,
          type: `patient_photo:${normalizedCategory}`,
          storage_path: storagePath,
          metadata: {
            category: normalizedCategory,
            original_name: f.name,
            mime: f.type,
            size: f.size,
          },
        })
        .select("id, case_id, user_id, type, storage_path, metadata, created_at")
        .maybeSingle();

      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }

      saved.push(row);
    }

    return NextResponse.json({ ok: true, savedCount: saved.length, saved });
  } catch (e: any) {
    console.error("patient-photos upload error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? "Server error") },
      { status: 500 }
    );
  }
}
