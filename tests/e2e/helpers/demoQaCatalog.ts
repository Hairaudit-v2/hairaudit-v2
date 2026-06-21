import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAuditCaseInsertData } from "../../../src/lib/cases/createCase";
import {
  DEMO_QA_SEED_BATCH_PREFIX,
  DEMO_QA_SEED_USER_PASSWORD,
  demoQaExternalCaseId,
  demoQaUserEmail,
} from "../../../src/lib/demo/qaCaseSeed/constants";
import { tryCreateSupabaseAdminClient } from "../../../src/lib/supabase/admin";
import type { PatientReviewPathway } from "../../../src/lib/patient/patientReviewPathway";

export { DEMO_QA_SEED_USER_PASSWORD };

export type DemoQaCaseEntry = {
  pathway: PatientReviewPathway;
  index: number;
  externalCaseId: string;
  email: string;
  caseId: string;
  reportId: string | null;
};

export type DemoQaCatalog = {
  preSurgery: DemoQaCaseEntry[];
  postSurgery: DemoQaCaseEntry[];
  all: DemoQaCaseEntry[];
};

function sortByIndex(a: DemoQaCaseEntry, b: DemoQaCaseEntry): number {
  return a.index - b.index;
}

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
    .select("id, case_id, pdf_path, version")
    .in("case_id", caseIds)
    .order("version", { ascending: false });

  const reportByCaseId = new Map<string, { id: string; pdf_path: string | null }>();
  for (const row of reports ?? []) {
    const caseId = row.case_id as string;
    if (!reportByCaseId.has(caseId)) {
      reportByCaseId.set(caseId, {
        id: row.id as string,
        pdf_path: (row as { pdf_path?: string | null }).pdf_path ?? null,
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

  if (entries.length === 0) return null;

  const preSurgery = entries.filter((e) => e.pathway === "pre_surgery").sort(sortByIndex);
  const postSurgery = entries.filter((e) => e.pathway === "post_surgery").sort(sortByIndex);

  return { preSurgery, postSurgery, all: [...preSurgery, ...postSurgery] };
}

export function catalogReady(catalog: DemoQaCatalog | null): catalog is DemoQaCatalog {
  return Boolean(catalog && catalog.preSurgery.length >= 10 && catalog.postSurgery.length >= 10);
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
