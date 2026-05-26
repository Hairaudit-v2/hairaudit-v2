import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import { computeCaseReadiness } from "@/lib/hair-audit/bulkUpload/validation";
import type { BulkCaseDraftInput } from "@/lib/hair-audit/bulkUpload/types";

export const runtime = "nodejs";

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseCases(body: unknown): BulkCaseDraftInput[] | null {
  if (!body || typeof body !== "object") return null;
  const cases = (body as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) return null;
  return cases.map((row, idx) => {
    const r = row as Record<string, unknown>;
    return {
      clientKey: asText(r.clientKey) || `case-${idx}`,
      id: asText(r.id) || undefined,
      case_label: asText(r.case_label) || `Case ${idx + 1}`,
      patient_reference: asText(r.patient_reference),
      patient_email: asText(r.patient_email),
      graft_count: parseIntOrNull(r.graft_count),
      hair_count: parseIntOrNull(r.hair_count),
      case_specific_notes: asText(r.case_specific_notes),
    };
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { batchId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const cases = parseCases(body);
  if (!cases) {
    return NextResponse.json({ ok: false, error: "Invalid cases payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: batch, error: batchErr } = await admin
    .from("hair_audit_case_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (batchErr) return NextResponse.json({ ok: false, error: batchErr.message }, { status: 500 });
  if (!batch) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });

  const { data: existingCases } = await admin
    .from("cases")
    .select("id")
    .eq("batch_id", batchId)
    .is("deleted_at", null);

  const existingIds = new Set((existingCases ?? []).map((c) => c.id));
  const incomingIds = new Set(cases.map((c) => c.id).filter(Boolean) as string[]);

  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDelete.length) {
    await admin.from("cases").update({ deleted_at: new Date().toISOString(), deleted_by: auth.userId }).in("id", toDelete);
  }

  const auditType = batch.clinic_id ? "clinic" : "doctor";
  const savedCases: unknown[] = [];

  for (const c of cases) {
    const imageCount = c.id
      ? ((
          await admin
            .from("hair_audit_case_images")
            .select("id", { count: "exact", head: true })
            .eq("batch_id", batchId)
            .eq("case_id", c.id)
        ).count ?? 0)
      : 0;

    const readiness = computeCaseReadiness(c, imageCount);
    const payload = {
      batch_id: batchId,
      case_label: c.case_label,
      patient_reference: c.patient_reference || null,
      patient_email: c.patient_email || null,
      graft_count: c.graft_count,
      hair_count: c.hair_count,
      case_specific_notes: c.case_specific_notes || null,
      intake_status: readiness.intakeStatus,
      title: c.patient_reference?.trim() || c.case_label,
      doctor_id: batch.doctor_id,
      clinic_id: batch.clinic_id,
      audit_type: auditType,
      submission_channel: "imported" as const,
      visibility_scope: "internal" as const,
      status: "draft",
    };

    if (c.id && existingIds.has(c.id)) {
      const { data, error } = await admin
        .from("cases")
        .update(payload)
        .eq("id", c.id)
        .select(
          "id, batch_id, case_label, patient_reference, patient_email, graft_count, hair_count, case_specific_notes, intake_status, status, title, audit_type, doctor_id, clinic_id, created_at"
        )
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      savedCases.push(data);
    } else {
      const { data, error } = await admin
        .from("cases")
        .insert({
          ...payload,
          user_id: auth.userId,
        })
        .select(
          "id, batch_id, case_label, patient_reference, patient_email, graft_count, hair_count, case_specific_notes, intake_status, status, title, audit_type, doctor_id, clinic_id, created_at"
        )
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      savedCases.push(data);
    }
  }

  await admin.from("hair_audit_case_batches").update({ status: "in_progress" }).eq("id", batchId);

  return NextResponse.json({ ok: true, cases: savedCases });
}
