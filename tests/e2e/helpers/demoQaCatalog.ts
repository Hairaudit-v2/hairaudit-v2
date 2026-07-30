import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAuditCaseInsertData } from "../../../src/lib/cases/createCase";
import {
  DEMO_QA_AUDITOR_EMAIL,
  DEMO_QA_SEED_BATCH_PREFIX,
  DEMO_QA_SEED_USER_PASSWORD,
  demoQaExternalCaseId,
  demoQaUserEmail,
} from "../../../src/lib/demo/qaCaseSeed/constants";
import type { DemoQaDonorFixtureKind } from "../../../src/lib/demo/qaCaseSeed/types";
import { tryCreateSupabaseAdminClient } from "../../../src/lib/supabase/admin";
import type { PatientReviewPathway } from "../../../src/lib/patient/patientReviewPathway";

export { DEMO_QA_SEED_USER_PASSWORD, DEMO_QA_AUDITOR_EMAIL };

export type DemoQaCaseEntry = {
  pathway: PatientReviewPathway;
  index: number;
  externalCaseId: string;
  email: string;
  caseId: string;
  reportId: string | null;
};

export type DemoQaDonorCaseEntry = DemoQaCaseEntry & {
  fixtureKind: DemoQaDonorFixtureKind;
  seedPathway: "donor_healing";
};

export type DemoQaCatalog = {
  preSurgery: DemoQaCaseEntry[];
  postSurgery: DemoQaCaseEntry[];
  donorHealing: DemoQaDonorCaseEntry[];
  all: DemoQaCaseEntry[];
  auditorEmail: string;
};

function sortByIndex(a: { index: number }, b: { index: number }): number {
  return a.index - b.index;
}

const DONOR_FIXTURE_KINDS: readonly DemoQaDonorFixtureKind[] = [
  "orientation_confirmed",
  "orientation_corrected",
  "missing_orientation_fallback",
  "partial_donor_evidence",
  "direct_clinical_assessment",
] as const;

export async function loadDemoQaCatalog(admin?: SupabaseClient | null): Promise<DemoQaCatalog | null> {
  const supabase = admin ?? tryCreateSupabaseAdminClient();
  if (!supabase) return null;

  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("id, external_case_id, patient_review_pathway")
    .like("external_case_id", `${DEMO_QA_SEED_BATCH_PREFIX}:%`);

  if (casesError || !cases?.length) return null;

  const caseIds = cases.map((c) => c.id as string);
  const { data: reports } = await supabase
    .from("reports")
    .select("id, case_id, pdf_path, version, summary")
    .in("case_id", caseIds)
    .order("version", { ascending: false });

  const reportByCaseId = new Map<
    string,
    { id: string; pdf_path: string | null; summary: Record<string, unknown> | null }
  >();
  for (const row of reports ?? []) {
    const caseId = row.case_id as string;
    if (!reportByCaseId.has(caseId)) {
      reportByCaseId.set(caseId, {
        id: row.id as string,
        pdf_path: (row as { pdf_path?: string | null }).pdf_path ?? null,
        summary: ((row as { summary?: Record<string, unknown> | null }).summary ??
          null) as Record<string, unknown> | null,
      });
    }
  }

  const entries: DemoQaCaseEntry[] = [];

  for (const pathway of ["pre_surgery", "post_surgery"] as const) {
    for (let index = 1; index <= 10; index += 1) {
      const externalCaseId = demoQaExternalCaseId(pathway, index);
      const match = cases.find((c) => c.external_case_id === externalCaseId);
      if (!match?.id) continue;

      const report = reportByCaseId.get(match.id as string);
      entries.push({
        pathway,
        index,
        externalCaseId,
        email: demoQaUserEmail(pathway, index),
        caseId: match.id as string,
        reportId: report?.id ?? null,
      });
    }
  }

  const donorHealing: DemoQaDonorCaseEntry[] = [];
  for (let index = 1; index <= DONOR_FIXTURE_KINDS.length; index += 1) {
    const externalCaseId = demoQaExternalCaseId("donor_healing", index);
    const match = cases.find((c) => c.external_case_id === externalCaseId);
    if (!match?.id) continue;
    const report = reportByCaseId.get(match.id as string);
    const seedMeta = report?.summary?.demo_qa_seed as
      | { donorFixtureKind?: DemoQaDonorFixtureKind }
      | undefined;
    const fixtureKind =
      seedMeta?.donorFixtureKind ?? DONOR_FIXTURE_KINDS[index - 1] ?? "orientation_confirmed";

    donorHealing.push({
      pathway: "post_surgery",
      seedPathway: "donor_healing",
      index,
      externalCaseId,
      email: demoQaUserEmail("donor_healing", index),
      caseId: match.id as string,
      reportId: report?.id ?? null,
      fixtureKind,
    });
  }

  if (entries.length === 0 && donorHealing.length === 0) return null;

  const preSurgery = entries.filter((e) => e.pathway === "pre_surgery").sort(sortByIndex);
  const postSurgery = entries.filter((e) => e.pathway === "post_surgery").sort(sortByIndex);

  return {
    preSurgery,
    postSurgery,
    donorHealing: donorHealing.sort(sortByIndex),
    all: [...preSurgery, ...postSurgery, ...donorHealing],
    auditorEmail: DEMO_QA_AUDITOR_EMAIL,
  };
}

export function catalogReady(catalog: DemoQaCatalog | null): catalog is DemoQaCatalog {
  return Boolean(catalog && catalog.preSurgery.length >= 10 && catalog.postSurgery.length >= 10);
}

export function donorReportCatalogReady(catalog: DemoQaCatalog | null): boolean {
  return Boolean(catalog && catalog.donorHealing.length >= DONOR_FIXTURE_KINDS.length);
}

export function findDonorFixture(
  catalog: DemoQaCatalog,
  kind: DemoQaDonorFixtureKind
): DemoQaDonorCaseEntry | undefined {
  return catalog.donorHealing.find((e) => e.fixtureKind === kind);
}

/** Prefer a post-surgery seed by 1-based index (post_01 → index 1). */
export function findPostSurgeryFixture(
  catalog: DemoQaCatalog,
  index: number
): DemoQaCaseEntry | undefined {
  return catalog.postSurgery.find((e) => e.index === index);
}

export async function ensureProcessingCaseForUser(args: {
  userId: string;
  pathway: PatientReviewPathway;
  externalCaseId?: string;
}): Promise<string | null> {
  const supabase = tryCreateSupabaseAdminClient();
  if (!supabase) return null;

  const externalCaseId =
    args.externalCaseId ?? `${DEMO_QA_SEED_BATCH_PREFIX}:e2e-processing:${args.pathway}`;

  const existing = await supabase
    .from("cases")
    .select("id")
    .eq("external_case_id", externalCaseId)
    .maybeSingle();

  const submittedAt = new Date().toISOString();
  const payload = {
    ...buildAuditCaseInsertData(args.userId, "patient", args.pathway),
    title: `E2E processing — ${args.pathway}`,
    status: "submitted",
    submitted_at: submittedAt,
    is_test: true,
    external_case_id: externalCaseId,
  };

  if (existing.data?.id) {
    await supabase.from("cases").update(payload).eq("id", existing.data.id);
    await supabase.from("reports").delete().eq("case_id", existing.data.id);
    return existing.data.id as string;
  }

  const { data, error } = await supabase.from("cases").insert(payload).select("id").single();
  if (error || !data?.id) return null;
  return data.id as string;
}
