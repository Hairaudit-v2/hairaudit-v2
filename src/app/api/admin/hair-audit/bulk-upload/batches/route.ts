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

export async function GET() {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("hair_audit_case_batches")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, batches: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const input = parseBatchInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Batch name is required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("hair_audit_case_batches")
    .insert({
      created_by: auth.userId,
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
      status: "draft",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, batch: data });
}
