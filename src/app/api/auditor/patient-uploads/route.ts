import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { canAccessCase } from "@/lib/case-access";
import { normalizeAuditorPatientPhotoCategory } from "@/lib/auditor/auditorPatientPhotoCategories";
import type { PatientUploadMetadata } from "@/lib/uploads/patientPhotoAuditMeta";
import {
  applyPatientPhotoCategoryFields,
  getPatientPhotoCategoryIntegrity,
  resolvePatientPhotoCategoryKeyAligned,
  summarizePatientPhotoCategoryIntegrity,
  syncPatientPhotoMetadataCategoryToType,
} from "@/lib/uploads/patientPhotoCategoryIntegrity";

export const runtime = "nodejs";

function supabaseBucket() {
  return process.env.CASE_FILES_BUCKET || "case-files";
}

function categoryFromUploadRow(u: { type?: string | null; metadata?: unknown }): string {
  return resolvePatientPhotoCategoryKeyAligned(u) ?? "uncategorized";
}

function displayNameFromMeta(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const dn = (metadata as PatientUploadMetadata).display_name;
  return typeof dn === "string" ? dn : null;
}

async function requireAuditor() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    return { error: NextResponse.json({ ok: false, error: "Forbidden: auditors only" }, { status: 403 }) };
  }
  return { user, admin };
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuditor();
    if ("error" in auth) return auth.error;
    const { user, admin } = auth;

    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId")?.trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr || !c) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    if (!(await canAccessCase(user.id, c))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: uploads, error: upErr } = await admin
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    const bucket = supabaseBucket();
    const patient = (uploads ?? []).filter((u) => String(u.type ?? "").startsWith("patient_photo:"));

    const signed = await Promise.all(
      patient.map(async (u) => {
        const integ = getPatientPhotoCategoryIntegrity(u);
        const { data } = await admin.storage.from(bucket).createSignedUrl(String(u.storage_path), 60 * 15);
        return {
          ...u,
          signedUrl: data?.signedUrl ?? null,
          categoryIntegrity: { needsAttention: integ.needsAttention, issues: integ.issues },
        };
      })
    );

    const categoryIntegritySummary = summarizePatientPhotoCategoryIntegrity(signed);

    const byCategory: Record<string, typeof signed> = {};
    for (const u of signed) {
      const cat = categoryFromUploadRow(u);
      byCategory[cat] = byCategory[cat] || [];
      byCategory[cat].push(u);
    }

    let corrections: unknown[] = [];
    try {
      const { data: logRows } = await admin
        .from("upload_audit_corrections")
        .select(
          "id, created_at, upload_id, actor_user_id, action, old_category, new_category, old_display_name, new_display_name, excluded_after"
        )
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(100);
      corrections = logRows ?? [];
    } catch {
      corrections = [];
    }

    return NextResponse.json({ ok: true, byCategory, uploads: signed, corrections, categoryIntegritySummary });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

type PatchBody = {
  caseId?: string;
  uploadId?: string;
  action?: string;
  category?: string;
  displayName?: string | null;
};

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuditor();
    if ("error" in auth) return auth.error;
    const { user, admin } = auth;

    const body = (await req.json().catch(() => null)) as PatchBody | null;
    const caseId = String(body?.caseId ?? "").trim();
    const uploadId = String(body?.uploadId ?? "").trim();
    const action = String(body?.action ?? "").trim();

    if (!caseId || !uploadId || !action) {
      return NextResponse.json({ ok: false, error: "Missing caseId, uploadId, or action" }, { status: 400 });
    }

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr || !c) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    if (!(await canAccessCase(user.id, c))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: row, error: loadErr } = await admin
      .from("uploads")
      .select("id, case_id, type, storage_path, metadata")
      .eq("id", uploadId)
      .maybeSingle();

    if (loadErr || !row || row.case_id !== caseId) {
      return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });
    }

    if (!String(row.type ?? "").startsWith("patient_photo:")) {
      return NextResponse.json({ ok: false, error: "Not a patient photo upload" }, { status: 400 });
    }

    const prevMeta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as PatientUploadMetadata;
    const oldCategory = categoryFromUploadRow(row);
    const oldDisplay = displayNameFromMeta(prevMeta);

    const logInsert = async (payload: {
      action: "reassign" | "rename" | "exclude" | "restore";
      new_category?: string | null;
      new_display_name?: string | null;
      excluded_after?: boolean | null;
    }) => {
      try {
        await admin.from("upload_audit_corrections").insert({
          case_id: caseId,
          upload_id: uploadId,
          actor_user_id: user.id,
          action: payload.action,
          old_category: oldCategory,
          new_category: payload.new_category ?? null,
          old_display_name: oldDisplay,
          new_display_name: payload.new_display_name !== undefined ? payload.new_display_name : null,
          excluded_after: payload.excluded_after ?? null,
        });
      } catch {
        /* table may not exist in older DBs */
      }
    };

    let nextMeta: PatientUploadMetadata = { ...prevMeta };
    let nextType = String(row.type ?? "");

    if (action === "reassign") {
      const rawCat = String(body?.category ?? "").trim();
      if (!rawCat) return NextResponse.json({ ok: false, error: "Missing category" }, { status: 400 });
      let newKey: string;
      try {
        newKey = normalizeAuditorPatientPhotoCategory(rawCat);
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
      }
      const assigned = applyPatientPhotoCategoryFields(newKey, prevMeta as Record<string, unknown>);
      nextType = assigned.type;
      nextMeta = assigned.metadata as PatientUploadMetadata;
      await logInsert({
        action: "reassign",
        new_category: newKey,
        excluded_after: nextMeta.audit_excluded === true,
      });
    } else if (action === "rename") {
      const dn = body?.displayName;
      if (dn !== null && typeof dn !== "string") {
        return NextResponse.json({ ok: false, error: "displayName must be string or null" }, { status: 400 });
      }
      const trimmed = dn === null ? "" : dn.trim();
      if (trimmed.length > 200) {
        return NextResponse.json({ ok: false, error: "Display name too long" }, { status: 400 });
      }
      if (trimmed === "") {
        delete nextMeta.display_name;
      } else {
        nextMeta = { ...nextMeta, display_name: trimmed };
      }
      await logInsert({
        action: "rename",
        new_category: oldCategory,
        new_display_name: trimmed === "" ? null : trimmed,
        excluded_after: nextMeta.audit_excluded === true,
      });
    } else if (action === "exclude") {
      nextMeta = {
        ...nextMeta,
        audit_excluded: true,
        audit_excluded_at: new Date().toISOString(),
        audit_excluded_by: user.id,
      };
      await logInsert({
        action: "exclude",
        new_category: oldCategory,
        excluded_after: true,
      });
    } else if (action === "restore") {
      nextMeta = {
        ...nextMeta,
        audit_excluded: false,
      };
      await logInsert({
        action: "restore",
        new_category: oldCategory,
        excluded_after: false,
      });
    } else {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    nextMeta = syncPatientPhotoMetadataCategoryToType(nextType, nextMeta as Record<string, unknown>) as PatientUploadMetadata;

    const { data: updated, error: upErr } = await admin
      .from("uploads")
      .update({ type: nextType, metadata: nextMeta })
      .eq("id", uploadId)
      .select("id, type, storage_path, metadata, created_at")
      .maybeSingle();

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    const integ = updated ? getPatientPhotoCategoryIntegrity(updated) : null;
    return NextResponse.json({
      ok: true,
      upload: updated,
      categoryIntegrity: integ
        ? { needsAttention: integ.needsAttention, issues: integ.issues, aligned: integ.aligned }
        : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
