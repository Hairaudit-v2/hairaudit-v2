import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * POST /api/audit/fill-minimum?caseId=...
 * Quick dev helper: fills minimum required answers + a few scored items
 * so you can validate scoring + report rendering.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: latestReport, error: repErr } = await supabase
    .from("reports")
    .select("id, version, summary, created_at")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (repErr) return NextResponse.json({ ok: false, error: repErr.message }, { status: 500 });
  if (!latestReport) return NextResponse.json({ ok: false, error: "No report found for case. Run seed-answers first." }, { status: 404 });

  const summary = (latestReport.summary ?? {}) as any;
  const answers = (summary.answers ?? {}) as any;

  // --- Fill MINIMUM INPUTS (section_id: patient_minimum_inputs) ---
  answers.patient_minimum_inputs = answers.patient_minimum_inputs ?? {};
  answers.patient_minimum_inputs.surgery_location = { value: "Australia, Brisbane", source: "manual" };
  answers.patient_minimum_inputs.clinic_name = { value: "Example Clinic", source: "manual" };
  answers.patient_minimum_inputs.surgery_date = { value: "2026-01-10", source: "manual" };
  answers.patient_minimum_inputs.procedure_cost = { value: "AUD 12000", source: "manual" };
  answers.patient_minimum_inputs.extraction_operator = { value: "doctor", source: "manual" };
  answers.patient_minimum_inputs.implantation_operator = { value: "doctor", source: "manual" };

  // --- Fill PHOTO GATES (text questions in their sections) ---
  answers.consent_expectations = answers.consent_expectations ?? {};
  answers.consent_expectations.patient_preop_photo_set = { value: "Uploaded", evidence_ids: ["pre1","pre2","pre3","pre4","pre5","pre6"], source: "manual" };

  answers.donor_outcome = answers.donor_outcome ?? {};
  answers.donor_outcome.patient_day0_donor_images = { value: "Uploaded", evidence_ids: ["donor_day0"], source: "manual" };

  answers.implantation_execution = answers.implantation_execution ?? {};
  answers.implantation_execution.patient_day0_recipient_images = { value: "Uploaded", evidence_ids: ["recipient_day0"], source: "manual" };

  // --- Fill a few SCORED questions (so score changes visibly) ---
  // Scale_0_5 questions should be numeric 0..5
  answers.dx_suitability = answers.dx_suitability ?? {};
  answers.dx_suitability.dx_accuracy = { value: 4, source: "manual" };
  answers.dx_suitability.stability_assessment = { value: 3, source: "manual" };
  answers.dx_suitability.donor_vs_goal_alignment = { value: 4, source: "manual" };
  answers.dx_suitability.contraindications_screen = { value: 4, source: "manual" };

  answers.consent_expectations.consent_quality = { value: 4, source: "manual" };
  answers.consent_expectations.expectations_realistic = { value: 4, source: "manual" };
  answers.consent_expectations.photo_documentation_preop = { value: 4, source: "manual" };

  // Save back
  const nextSummary = { ...summary, answers };
  const { error: upErr } = await supabase
    .from("reports")
    .update({ summary: nextSummary })
    .eq("id", latestReport.id);

  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, reportId: latestReport.id, version: latestReport.version });
}
