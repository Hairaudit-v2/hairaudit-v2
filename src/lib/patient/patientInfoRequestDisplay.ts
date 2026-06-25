import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractPatientInfoRequestFromReportSummary,
  isCaseAwaitingPatientInformation,
  type PatientInfoRequestState,
} from "@/lib/auditor/patientInfoRequest";

export type PatientInfoRequestByCaseId = Record<string, PatientInfoRequestState>;

/**
 * Load active patient info requests for dashboard / case pages.
 */
export async function loadPatientInfoRequestsForCases(
  admin: SupabaseClient,
  cases: ReadonlyArray<{ id: string; status?: string | null }>
): Promise<PatientInfoRequestByCaseId> {
  const awaitingIds = cases
    .filter((c) => isCaseAwaitingPatientInformation(c.status))
    .map((c) => c.id);
  if (awaitingIds.length === 0) return {};

  const { data: reports } = await admin
    .from("reports")
    .select("case_id, summary")
    .in("case_id", awaitingIds)
    .order("version", { ascending: false });

  const byCase: PatientInfoRequestByCaseId = {};
  for (const row of reports ?? []) {
    const caseId = String((row as { case_id?: string }).case_id ?? "");
    if (!caseId || byCase[caseId]) continue;
    const extracted = extractPatientInfoRequestFromReportSummary(
      (row as { summary?: unknown }).summary
    );
    if (extracted) byCase[caseId] = extracted;
  }

  for (const id of awaitingIds) {
    if (!byCase[id]) {
      byCase[id] = {
        requestType: "other",
        reasonLabel: "Our review team needs a little more information before finalising your report.",
        sentAt: null,
        sanitizedNote: null,
      };
    }
  }

  return byCase;
}

export function toPatientInfoRequestDisplay(
  state: PatientInfoRequestState | null | undefined
): { requestType: string; reasonLabel: string } | null {
  if (!state) return null;
  return { requestType: state.requestType, reasonLabel: state.reasonLabel };
}
