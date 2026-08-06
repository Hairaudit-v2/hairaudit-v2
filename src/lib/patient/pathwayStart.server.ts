/**
 * HA-PATHWAY-START-403-FIX — server-only pathway start DB helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

/**
 * Provisional patient profile for pathway start only.
 * Does not invent a role in GET /api/profiles — this is an explicit write
 * after the user chose a patient pathway.
 */
export async function provisionPatientProfileForPathwayStart(args: {
  admin: SupabaseClient;
  userId: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await args.admin.from("profiles").upsert(
    {
      id: args.userId,
      role: "patient",
      email: args.email ?? null,
      name: args.displayName ?? null,
    },
    { onConflict: "id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Resume an incomplete patient draft for the same pathway when present. */
export async function findResumablePatientDraft(args: {
  admin: SupabaseClient;
  userId: string;
  pathway: PatientReviewPathway;
}): Promise<{ caseId: string } | null> {
  const { data, error } = await args.admin
    .from("cases")
    .select("id")
    .eq("user_id", args.userId)
    .eq("patient_id", args.userId)
    .eq("patient_review_pathway", args.pathway)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return { caseId: String(data.id) };
}
