import type { SupabaseClient } from "@supabase/supabase-js";
import type { BulkBatchContextDisplay, HairAuditCaseBatchRow } from "./types";

export type BulkBatchContext = {
  batch: HairAuditCaseBatchRow;
  doctorName: string | null;
  clinicName: string | null;
  display: BulkBatchContextDisplay;
};

function displayValue(value: string | null | undefined): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

export function buildBulkBatchDisplayFields(
  batch: HairAuditCaseBatchRow,
  doctorName: string | null,
  clinicName: string | null
): BulkBatchContextDisplay {
  const fields: BulkBatchContextDisplay["fields"] = [];

  const push = (label: string, value: string | null | undefined) => {
    const v = displayValue(value);
    if (v) fields.push({ label, value: v });
  };

  push("Batch name", batch.batch_name);
  push("Doctor", doctorName);
  push("Clinic", clinicName);
  push("Shared surgery date", batch.shared_surgery_date);
  push("Location", batch.shared_location);
  push("Punch type", batch.shared_punch_type);
  push("Punch size", batch.shared_punch_size);
  push("Extraction method", batch.shared_extraction_method);
  push("Implantation method", batch.shared_implantation_method);
  push("Equipment notes", batch.shared_equipment_notes);
  push("Preservation notes", batch.shared_preservation_notes);
  push("General notes", batch.shared_general_notes);

  return {
    batchId: batch.id,
    batchName: batch.batch_name,
    fields,
  };
}

export async function loadBulkBatchContext(
  admin: SupabaseClient,
  batchId: string | null | undefined
): Promise<BulkBatchContext | null> {
  if (!batchId) return null;

  const { data: batch, error } = await admin
    .from("hair_audit_case_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (error || !batch) return null;

  const row = batch as HairAuditCaseBatchRow;
  let doctorName: string | null = null;
  let clinicName: string | null = null;

  if (row.doctor_id) {
    const { data: doctorProfile } = await admin
      .from("doctor_profiles")
      .select("doctor_name")
      .eq("linked_user_id", row.doctor_id)
      .maybeSingle();
    doctorName = doctorProfile?.doctor_name ?? null;
  }

  if (row.clinic_id) {
    const { data: clinicProfile } = await admin
      .from("clinic_profiles")
      .select("clinic_name")
      .eq("linked_user_id", row.clinic_id)
      .maybeSingle();
    clinicName = clinicProfile?.clinic_name ?? null;
  }

  return {
    batch: row,
    doctorName,
    clinicName,
    display: buildBulkBatchDisplayFields(row, doctorName, clinicName),
  };
}
