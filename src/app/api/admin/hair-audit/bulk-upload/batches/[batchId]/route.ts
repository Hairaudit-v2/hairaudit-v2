import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import type { BulkBatchDetailsInput } from "@/lib/hair-audit/bulkUpload/types";

export const runtime = "nodejs";

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNullableText(v: unknown): string | null {
  const t = asText(v);
  return t || null;
}

function asNullableUuid(v: unknown): string | null {
  const t = asText(v);
  return t || null;
}

function parseBatchInput(body: unknown): BulkBatchDetailsInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const batch_name = asText(b.batch_name);
  if (!batch_name) return null;
  return {
    batch_name,
    doctor_id: asNullableUuid(b.doctor_id),
    clinic_id: asNullableUuid(b.clinic_id),
    shared_surgery_date: asNullableText(b.shared_surgery_date),
    shared_location: asText(b.shared_location),
    shared_punch_type: asText(b.shared_punch_type),
    shared_punch_size: asText(b.shared_punch_size),
    shared_extraction_method: asText(b.shared_extraction_method),
    shared_implantation_method: asText(b.shared_implantation_method),
    shared_equipment_notes: asText(b.shared_equipment_notes),
    shared_preservation_notes: asText(b.shared_preservation_notes),
    shared_general_notes: asText(b.shared_general_notes),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { batchId } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const [batchRes, casesRes, imagesRes] = await Promise.all([
    admin.from("hair_audit_case_batches").select("*").eq("id", batchId).maybeSingle(),
    admin
      .from("cases")
      .select(
        "id, batch_id, case_label, patient_reference, patient_email, graft_count, hair_count, case_specific_notes, intake_status, status, title, audit_type, doctor_id, clinic_id, created_at"
      )
      .eq("batch_id", batchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("hair_audit_case_images")
      .select("*")
      .eq("batch_id", batchId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (batchRes.error) return NextResponse.json({ ok: false, error: batchRes.error.message }, { status: 500 });
  if (!batchRes.data) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
  if (casesRes.error) return NextResponse.json({ ok: false, error: casesRes.error.message }, { status: 500 });
  if (imagesRes.error) return NextResponse.json({ ok: false, error: imagesRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    batch: batchRes.data,
    cases: casesRes.data ?? [],
    images: imagesRes.data ?? [],
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { batchId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const input = parseBatchInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Batch name is required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const status = asNullableText((body as Record<string, unknown> | null)?.status);

  const updatePayload: Record<string, unknown> = {
    batch_name: input.batch_name,
    doctor_id: input.doctor_id,
    clinic_id: input.clinic_id,
    shared_surgery_date: input.shared_surgery_date,
    shared_location: input.shared_location || null,
    shared_punch_type: input.shared_punch_type || null,
    shared_punch_size: input.shared_punch_size || null,
    shared_extraction_method: input.shared_extraction_method || null,
    shared_implantation_method: input.shared_implantation_method || null,
    shared_equipment_notes: input.shared_equipment_notes || null,
    shared_preservation_notes: input.shared_preservation_notes || null,
    shared_general_notes: input.shared_general_notes || null,
  };
  if (status) updatePayload.status = status;

  const { data, error } = await admin
    .from("hair_audit_case_batches")
    .update(updatePayload)
    .eq("id", batchId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, batch: data });
}
