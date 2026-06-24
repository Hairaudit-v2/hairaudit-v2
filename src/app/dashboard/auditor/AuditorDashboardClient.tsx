"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuditorCaseQueueCard from "@/components/auditor/AuditorCaseQueueCard";
import AuditorNextCaseCard from "@/components/auditor/AuditorNextCaseCard";
import AuditorWorkloadStatusCards from "@/components/auditor/AuditorWorkloadStatusCards";
import AuditorFailedRecoveryCard from "@/components/auditor/AuditorFailedRecoveryCard";
import AuditorWaitingOnPatientCard from "@/components/auditor/AuditorWaitingOnPatientCard";
import AuditorOperationsAnalytics from "@/components/auditor/AuditorOperationsAnalytics";
import LiveClinicAuditBuildProgressPanel from "@/components/dashboard/LiveClinicAuditBuildProgressPanel";
import {
  computeWorkloadStatus,
  deriveAuditorQueueCase,
  selectNextCaseToProcess,
  sortActiveWorkQueue,
  sortSearchResults,
  type AuditorQueueCaseInput,
} from "@/lib/auditor/auditorQueueTriage";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";

type CaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  submitted_at?: string | null;
  audit_type: "patient" | "doctor" | "clinic" | null;
  patient_review_pathway?: string | null;
  archived_at?: string | null;
};

type ReportRow = {
  case_id: string;
  status: string | null;
  pdf_path: string | null;
  created_at: string;
  auditor_review_status?: string | null;
  summary?: Record<string, unknown> | null;
};

type EvidenceRow = {
  case_id: string;
  quality_score: number | null;
  missing_categories: string[] | null;
  status?: string | null;
};

type UploadStats = {
  imageUploadCount: number;
  pdfDocumentCount: number;
  uploadTypes: Array<{ type?: string | null }>;
};

type ActionModalState =
  | { kind: "none" }
  | { kind: "request_info"; caseId: string; caseLabel: string };

export default function AuditorDashboardClient(props: {
  cases: CaseRow[];
  reportByCase: Record<string, ReportRow>;
  evidenceByCase: Record<string, EvidenceRow>;
  clinicNameByCaseId: Record<string, string>;
  patientNameByCaseId: Record<string, string>;
  patientEmailByCaseId: Record<string, string>;
  hasClinicalHistoryByCaseId: Record<string, boolean>;
  uploadStatsByCaseId: Record<string, UploadStats>;
  waitingOnTranslationByCaseId: Record<string, boolean>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showFailedRecovery, setShowFailedRecovery] = useState(false);
  const [modal, setModal] = useState<ActionModalState>({ kind: "none" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyCaseId, setActionBusyCaseId] = useState<string | null>(null);

  const queueRows = useMemo(() => {
    const nowMs = Date.now();
    return props.cases
      .filter((c) => !c.archived_at)
      .map((base) => {
        const uploadStats = props.uploadStatsByCaseId[base.id] ?? {
          imageUploadCount: 0,
          pdfDocumentCount: 0,
          uploadTypes: [],
        };
        const input: AuditorQueueCaseInput = {
          id: base.id,
          title: base.title,
          status: base.status,
          created_at: base.created_at,
          updated_at: base.updated_at ?? null,
          submitted_at: base.submitted_at ?? null,
          audit_type: base.audit_type,
          patient_review_pathway: base.patient_review_pathway,
          archived_at: base.archived_at ?? null,
          imageUploadCount: uploadStats.imageUploadCount,
          pdfDocumentCount: uploadStats.pdfDocumentCount,
          uploadTypes: uploadStats.uploadTypes,
          hasClinicalHistory: props.hasClinicalHistoryByCaseId[base.id] ?? false,
          patientName: props.patientNameByCaseId[base.id] ?? null,
          patientEmail: props.patientEmailByCaseId[base.id] ?? null,
          waitingOnTranslation: props.waitingOnTranslationByCaseId[base.id] ?? false,
          report: props.reportByCase[base.id] ?? null,
          evidence: props.evidenceByCase[base.id] ?? null,
        };
        const derived = deriveAuditorQueueCase(input, nowMs);
        return {
          input,
          derived,
          clinicName: props.clinicNameByCaseId[base.id] ?? null,
        };
      });
  }, [props]);

  const workloadStatus = useMemo(() => computeWorkloadStatus(queueRows), [queueRows]);

  const nextCase = useMemo(() => selectNextCaseToProcess(queueRows), [queueRows]);

  const activeQueueRows = useMemo(() => {
    const rows = queueRows.filter(
      (row) => row.derived.inActiveWorkQueue && row.input.id !== nextCase?.input.id
    );
    return sortActiveWorkQueue(rows);
  }, [queueRows, nextCase]);

  const failedRecoveryRows = useMemo(() => {
    return queueRows
      .filter((row) => row.derived.inFailedRecovery && !row.derived.isInactive)
      .sort((a, b) => b.derived.priorityScore - a.derived.priorityScore);
  }, [queueRows]);

  const waitingOnPatientRows = useMemo(() => {
    return queueRows
      .filter((row) => row.derived.waitingOnPatient)
      .sort((a, b) => b.derived.priorityScore - a.derived.priorityScore);
  }, [queueRows]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return sortSearchResults(
      queueRows.filter((row) => {
        const { input, derived } = row;
        return (
          input.id.toLowerCase().includes(q) ||
          String(input.patientName ?? "").toLowerCase().includes(q) ||
          String(input.patientEmail ?? "").toLowerCase().includes(q) ||
          derived.caseNumberLabel.toLowerCase().includes(q) ||
          String(input.title ?? "").toLowerCase().includes(q)
        );
      })
    ).slice(0, 8);
  }, [queueRows, search]);

  async function lifecycle(
    action: "mark_in_progress" | "request_more_information",
    caseId: string,
    actionReason?: string
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auditor/cases/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action, reason: actionReason ?? "" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Action failed");
      setModal({ kind: "none" });
      setReason("");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function queueRerun(
    caseId: string,
    action: "regenerate_ai_audit" | "full_reaudit",
    rerunReason: "failed_previous_run" | "auditor_review_request" | "document_assisted_image_limited"
  ) {
    setActionBusyCaseId(caseId);
    setError(null);
    try {
      const res = await fetch("/api/auditor/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action, reason: rerunReason, notes: null }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Rerun failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rerun failed");
    } finally {
      setActionBusyCaseId(null);
    }
  }

  async function retryPdf(caseId: string) {
    setActionBusyCaseId(caseId);
    setError(null);
    try {
      const res = await fetch("/api/auditor/rebuild-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "PDF rebuild failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF rebuild failed");
    } finally {
      setActionBusyCaseId(null);
    }
  }

  async function onOpenCase(caseId: string) {
    const ok = await lifecycle("mark_in_progress", caseId);
    if (ok) router.push(`/cases/${caseId}`);
  }

  const cardBusy = (caseId: string) => busy || actionBusyCaseId === caseId;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Clinical Operations Desk</h1>
        <p className="text-slate-600 text-sm mt-1">What needs your attention right now.</p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {nextCase ? (
        <AuditorNextCaseCard
          input={nextCase.input}
          derived={nextCase.derived}
          busy={cardBusy(nextCase.input.id)}
          onOpenCase={onOpenCase}
          onRegenerateAudit={(caseId) => void queueRerun(caseId, "regenerate_ai_audit", "auditor_review_request")}
          onImageLimitedOverride={(caseId) =>
            void queueRerun(caseId, "full_reaudit", AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED)
          }
        />
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-600">No cases need immediate processing.</p>
        </section>
      )}

      <AuditorWorkloadStatusCards status={workloadStatus} />

      <section>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient name, email, or case id"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {search.trim() && (
          <div className="mt-3 space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-slate-500">No matching active cases.</p>
            ) : (
              searchResults.map((row) => (
                <button
                  key={`search-${row.input.id}`}
                  type="button"
                  onClick={() => void onOpenCase(row.input.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>
                    Case {row.derived.caseNumberLabel} · {row.input.patientName ?? row.input.title ?? "Unknown"}
                  </span>
                  <span className="text-xs text-slate-500">{row.derived.badge.replace(/_/g, " ")}</span>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Active Cases</h2>
          <p className="text-sm text-slate-500 mt-0.5">Cases needing work now — failed first, then ready, image-limited, manual input.</p>
        </header>
        {activeQueueRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
            No additional active cases in queue.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeQueueRows.map((row) => (
              <AuditorCaseQueueCard
                key={row.input.id}
                input={row.input}
                derived={row.derived}
                clinicName={row.clinicName}
                variant="active"
                busy={cardBusy(row.input.id)}
                onOpenCase={onOpenCase}
                onRegenerateAudit={() => {}}
                onRequestMissingImages={() => {}}
                onMarkForReview={() => {}}
                onRetryFailedAudit={() => {}}
                onImageLimitedOverride={() => {}}
              />
            ))}
          </div>
        )}
      </section>

      {failedRecoveryRows.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50/30">
          <button
            type="button"
            onClick={() => setShowFailedRecovery((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h2 className="text-base font-semibold text-red-900">Failed Case Recovery</h2>
              <p className="text-xs text-red-700/80 mt-0.5">{failedRecoveryRows.length} failed case(s)</p>
            </div>
            <span className="text-sm text-red-700">{showFailedRecovery ? "▲ Hide" : "▼ Show"}</span>
          </button>
          {showFailedRecovery && (
            <div className="border-t border-red-200 p-4 grid gap-4 md:grid-cols-2">
              {failedRecoveryRows.map((row) => (
                <AuditorFailedRecoveryCard
                  key={`failed-${row.input.id}`}
                  input={row.input}
                  derived={row.derived}
                  busy={cardBusy(row.input.id)}
                  onRetryPdf={(caseId) => void retryPdf(caseId)}
                  onOpenCase={onOpenCase}
                  onRetryFailedAudit={(caseId) => void queueRerun(caseId, "full_reaudit", "failed_previous_run")}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Waiting On Patient</h2>
          <p className="text-sm text-slate-500 mt-0.5">Cases where patient action is required before audit can proceed.</p>
        </header>
        {waitingOnPatientRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
            No cases waiting on patient action.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {waitingOnPatientRows.map((row) => (
              <AuditorWaitingOnPatientCard
                key={`waiting-${row.input.id}`}
                input={row.input}
                derived={row.derived}
                busy={cardBusy(row.input.id)}
                onRequestMissingImages={(caseId, label) => {
                  setReason("");
                  setModal({ kind: "request_info", caseId, caseLabel: label });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <AuditorOperationsAnalytics />

      <LiveClinicAuditBuildProgressPanel />

      {modal.kind === "request_info" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4">
          <div className="mx-auto mt-24 max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">Request Missing Images</h3>
            <p className="mt-2 text-sm text-slate-600">Case: {modal.caseLabel}</p>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional message to patient"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setModal({ kind: "none" });
                  setReason("");
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void lifecycle("request_more_information", modal.caseId, reason.trim())}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
