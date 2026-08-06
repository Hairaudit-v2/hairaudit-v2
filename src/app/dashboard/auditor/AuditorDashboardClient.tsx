"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuditorCaseQueueCard from "@/components/auditor/AuditorCaseQueueCard";
import AuditorNextCaseCard from "@/components/auditor/AuditorNextCaseCard";
import AuditorWorkloadStatusCards, {
  type AuditorWorkloadFilter,
} from "@/components/auditor/AuditorWorkloadStatusCards";
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
import {
  AUDITOR_CASE_WORKSPACE_PATH,
  isLikelyTestOrFakeCase,
  type AuditorCaseAction,
} from "@/lib/auditor/auditorCaseActions";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";

type CaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  submitted_at?: string | null;
  auditor_started_at?: string | null;
  assigned_auditor_id?: string | null;
  external_case_id?: string | null;
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
  | { kind: "request_info"; caseId: string; caseLabel: string }
  | { kind: "archive"; caseId: string; caseLabel: string }
  | { kind: "delete"; caseId: string; caseLabel: string; likelyTest: boolean }
  | { kind: "bulk_delete_tests"; caseIds: string[] };

type QueueRow = {
  input: AuditorQueueCaseInput;
  derived: ReturnType<typeof deriveAuditorQueueCase>;
  clinicName: string | null;
};

function EmptyQueue({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
      {message}
    </div>
  );
}

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
  const [filter, setFilter] = useState<AuditorWorkloadFilter>("all");
  const [showSecondary, setShowSecondary] = useState(false);
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
          auditor_started_at: base.auditor_started_at ?? null,
          assigned_auditor_id: base.assigned_auditor_id ?? null,
          external_case_id: base.external_case_id ?? null,
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
        } satisfies QueueRow;
      });
  }, [props]);

  const workloadStatus = useMemo(() => computeWorkloadStatus(queueRows), [queueRows]);

  const readyRows = useMemo(() => {
    return sortActiveWorkQueue(
      queueRows.filter((row) => row.derived.isReadyToAudit && !row.derived.isInactive)
    );
  }, [queueRows]);

  const failedRows = useMemo(() => {
    return queueRows
      .filter((row) => row.derived.inFailedRecovery && !row.derived.isInactive)
      .sort((a, b) => b.derived.priorityScore - a.derived.priorityScore);
  }, [queueRows]);

  const waitingOnPatientRows = useMemo(() => {
    return queueRows
      .filter((row) => row.derived.waitingOnPatient)
      .sort((a, b) => b.derived.priorityScore - a.derived.priorityScore);
  }, [queueRows]);

  const likelyTestRows = useMemo(() => {
    return queueRows.filter((row) =>
      isLikelyTestOrFakeCase({
        patientEmail: row.input.patientEmail,
        external_case_id: row.input.external_case_id,
        title: row.input.title,
      })
    );
  }, [queueRows]);

  const nextCase = useMemo(() => {
    if (filter === "ready") return readyRows[0] ?? null;
    if (filter === "failed") return failedRows[0] ?? null;
    if (filter === "waiting") return waitingOnPatientRows[0] ?? null;
    return selectNextCaseToProcess(queueRows);
  }, [filter, queueRows, readyRows, failedRows, waitingOnPatientRows]);

  const otherActiveRows = useMemo(() => {
    if (filter !== "all") return [];
    const nextId = nextCase?.input.id;
    return sortActiveWorkQueue(
      queueRows.filter(
        (row) =>
          row.derived.inActiveWorkQueue &&
          !row.derived.isReadyToAudit &&
          !row.derived.isFailed &&
          row.input.id !== nextId
      )
    );
  }, [filter, queueRows, nextCase]);

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
    action: "mark_in_progress" | "request_more_information" | "mark_needs_manual_review" | "archive" | "delete",
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

  async function bulkDeleteTestCases(caseIds: string[], actionReason: string) {
    setBusy(true);
    setError(null);
    try {
      for (const caseId of caseIds) {
        const res = await fetch("/api/auditor/cases/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, action: "delete", reason: actionReason }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? `Failed to delete ${caseId}`);
      }
      setModal({ kind: "none" });
      setReason("");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk delete failed");
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

  function openWorkspace(caseId: string) {
    router.push(AUDITOR_CASE_WORKSPACE_PATH(caseId));
  }

  async function openWorkspaceClaiming(caseId: string) {
    const ok = await lifecycle("mark_in_progress", caseId);
    if (ok) openWorkspace(caseId);
  }

  async function handleCaseAction(action: AuditorCaseAction, caseId: string, caseLabel: string) {
    switch (action.kind) {
      case "start_audit":
      case "continue_audit":
      case "open_manual_audit":
        if (action.claimAssignment) {
          await openWorkspaceClaiming(caseId);
        } else {
          openWorkspace(caseId);
        }
        return;
      case "view_case":
      case "review_report":
      case "edit_report":
      case "finalise_report":
        openWorkspace(caseId);
        return;
      case "request_missing_images":
        setReason("");
        setModal({ kind: "request_info", caseId, caseLabel });
        return;
      case "retry_processing":
        await queueRerun(caseId, "full_reaudit", "failed_previous_run");
        return;
      case "retry_pdf":
        await retryPdf(caseId);
        return;
      case "regenerate_audit":
        await queueRerun(caseId, "regenerate_ai_audit", "auditor_review_request");
        return;
      case "image_limited_override":
        await queueRerun(caseId, "full_reaudit", AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED);
        return;
      case "mark_for_review":
        await lifecycle("mark_needs_manual_review", caseId);
        return;
      case "archive_case":
        setReason("");
        setModal({ kind: "archive", caseId, caseLabel });
        return;
      case "delete_case": {
        const row = queueRows.find((r) => r.input.id === caseId);
        setReason(
          isLikelyTestOrFakeCase({
            patientEmail: row?.input.patientEmail,
            external_case_id: row?.input.external_case_id,
            title: row?.input.title,
          })
            ? "Test / fake audit cleanup"
            : ""
        );
        setModal({
          kind: "delete",
          caseId,
          caseLabel,
          likelyTest: isLikelyTestOrFakeCase({
            patientEmail: row?.input.patientEmail,
            external_case_id: row?.input.external_case_id,
            title: row?.input.title,
          }),
        });
        return;
      }
      default:
        openWorkspace(caseId);
    }
  }

  const cardBusy = (caseId: string) => busy || actionBusyCaseId === caseId;
  const showReady = filter === "all" || filter === "ready";
  const showFailed = filter === "all" || filter === "failed";
  const showWaiting = filter === "all" || filter === "waiting";
  const readyList = readyRows.filter((row) => row.input.id !== nextCase?.input.id);
  const failedList = failedRows.filter((row) => row.input.id !== nextCase?.input.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Clinical Operations Desk</h1>
        <p className="text-slate-600 text-sm mt-1">
          Review ready audits, recover failed processing, and chase missing patient uploads.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <AuditorWorkloadStatusCards status={workloadStatus} selected={filter} onSelect={setFilter} />

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
                  onClick={() => void openWorkspaceClaiming(row.input.id)}
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

      {nextCase ? (
        <AuditorNextCaseCard
          input={nextCase.input}
          derived={nextCase.derived}
          busy={cardBusy(nextCase.input.id)}
          onAction={handleCaseAction}
        />
      ) : filter !== "all" ? (
        <EmptyQueue message={`No cases in this filter right now.`} />
      ) : null}

      {showReady && (
        <section id="ready-to-audit">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ready To Audit</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {readyRows.length} case{readyRows.length === 1 ? "" : "s"} with complete intake — Start or Continue Audit.
              </p>
            </div>
            {filter !== "ready" && readyRows.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("ready")}
                className="text-sm font-medium text-emerald-800 hover:underline"
              >
                Focus ready only
              </button>
            )}
          </header>
          {readyList.length === 0 && readyRows.length === 0 ? (
            <EmptyQueue message="No cases are ready to audit." />
          ) : readyList.length === 0 ? (
            <p className="text-sm text-slate-500">The next ready case is featured above.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {readyList.map((row) => (
                <AuditorCaseQueueCard
                  key={`ready-${row.input.id}`}
                  input={row.input}
                  derived={row.derived}
                  clinicName={row.clinicName}
                  variant="active"
                  busy={cardBusy(row.input.id)}
                  onAction={handleCaseAction}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {showFailed && (
        <section id="failed-cases" className="rounded-xl border border-red-200 bg-red-50/30 p-4">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-red-900">Failed Processing</h2>
              <p className="text-sm text-red-800/80 mt-0.5">
                {failedRows.length} failed case{failedRows.length === 1 ? "" : "s"} — Open Manual Audit remains available.
              </p>
            </div>
            {filter !== "failed" && failedRows.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("failed")}
                className="text-sm font-medium text-red-800 hover:underline"
              >
                Focus failed only
              </button>
            )}
          </header>
          {failedList.length === 0 && failedRows.length === 0 ? (
            <EmptyQueue message="No failed cases." />
          ) : failedList.length === 0 ? (
            <p className="text-sm text-red-800/80">The next failed case is featured above.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {failedList.map((row) => (
                <AuditorFailedRecoveryCard
                  key={`failed-${row.input.id}`}
                  input={row.input}
                  derived={row.derived}
                  busy={cardBusy(row.input.id)}
                  onAction={handleCaseAction}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {showWaiting && (
        <section id="waiting-on-patient">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Waiting On Patient</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Missing images or uploads — you can still View Case and request information.
              </p>
            </div>
            {filter !== "waiting" && waitingOnPatientRows.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("waiting")}
                className="text-sm font-medium text-orange-800 hover:underline"
              >
                Focus waiting only
              </button>
            )}
          </header>
          {waitingOnPatientRows.length === 0 ? (
            <EmptyQueue message="No cases waiting on patient action." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {waitingOnPatientRows
                .filter((row) => filter !== "waiting" || row.input.id !== nextCase?.input.id)
                .map((row) => (
                  <AuditorWaitingOnPatientCard
                    key={`waiting-${row.input.id}`}
                    input={row.input}
                    derived={row.derived}
                    busy={cardBusy(row.input.id)}
                    onAction={handleCaseAction}
                  />
                ))}
            </div>
          )}
        </section>
      )}

      {filter === "all" && otherActiveRows.length > 0 && (
        <section>
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Also In Queue</h2>
            <p className="text-sm text-slate-500 mt-0.5">Image-limited or manual-input cases that still need attention.</p>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {otherActiveRows.map((row) => (
              <AuditorCaseQueueCard
                key={`other-${row.input.id}`}
                input={row.input}
                derived={row.derived}
                clinicName={row.clinicName}
                variant="active"
                busy={cardBusy(row.input.id)}
                onAction={handleCaseAction}
              />
            ))}
          </div>
        </section>
      )}

      {likelyTestRows.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50/40 p-4">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-amber-950">Likely test / fake audits</h2>
              <p className="text-sm text-amber-900/80 mt-0.5">
                Matched demo-qa external ids, @hairaudit.test emails, or demo/test titles. Soft-delete removes them from the desk; data is retained for audit trail.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReason("Bulk cleanup of demo / test audits");
                setModal({
                  kind: "bulk_delete_tests",
                  caseIds: likelyTestRows.map((r) => r.input.id),
                });
              }}
              className="rounded-lg border border-rose-400 bg-white px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-60"
            >
              Soft-delete all {likelyTestRows.length}
            </button>
          </header>
          <ul className="space-y-2 text-sm text-amber-950">
            {likelyTestRows.slice(0, 12).map((row) => (
              <li
                key={`test-${row.input.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <span>
                  Case {row.derived.caseNumberLabel}
                  {row.input.patientEmail ? ` · ${row.input.patientEmail}` : ""}
                  {row.input.external_case_id ? ` · ${row.input.external_case_id}` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCaseAction({ kind: "view_case", label: "View Case", primary: false, opensWorkspace: true, claimAssignment: false }, row.input.id, row.input.title ?? row.input.id.slice(0, 8))}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void handleCaseAction(
                        { kind: "delete_case", label: "Delete", primary: false, opensWorkspace: false, claimAssignment: false },
                        row.input.id,
                        row.input.title ?? row.input.id.slice(0, 8)
                      )
                    }
                    className="rounded border border-rose-400 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {likelyTestRows.length > 12 && (
            <p className="mt-2 text-xs text-amber-900/70">Showing 12 of {likelyTestRows.length}. Use Soft-delete all to clear the full set.</p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => setShowSecondary((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-800">Operations analytics & build progress</h2>
            <p className="text-xs text-slate-500 mt-0.5">Secondary tooling — not required for audit review</p>
          </div>
          <span className="text-sm text-slate-600">{showSecondary ? "▲ Hide" : "▼ Show"}</span>
        </button>
        {showSecondary && (
          <div className="space-y-6 border-t border-slate-200 p-4">
            <AuditorOperationsAnalytics />
            <LiveClinicAuditBuildProgressPanel />
          </div>
        )}
      </section>

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

      {(modal.kind === "archive" || modal.kind === "delete" || modal.kind === "bulk_delete_tests") && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4">
          <div className="mx-auto mt-24 max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              {modal.kind === "archive"
                ? "Archive case"
                : modal.kind === "bulk_delete_tests"
                  ? `Soft-delete ${modal.caseIds.length} test/fake audits`
                  : "Soft-delete case"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {modal.kind === "archive"
                ? `Case: ${modal.caseLabel}. Archived cases leave the active desk queue.`
                : modal.kind === "bulk_delete_tests"
                  ? "This soft-deletes matched demo/test cases. Records stay in the database with deleted_at for audit trail — not a hard purge."
                  : `Case: ${modal.caseLabel}. Soft-delete removes it from the desk. ${modal.likelyTest ? "Detected as likely test/fake." : "Use a clear reason — required."}`}
            </p>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              placeholder={
                modal.kind === "archive"
                  ? "Optional archive reason"
                  : "Required delete reason (e.g. Test audit cleanup)"
              }
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
                disabled={busy || (modal.kind !== "archive" && !reason.trim())}
                onClick={() => {
                  if (modal.kind === "archive") {
                    void lifecycle("archive", modal.caseId, reason.trim());
                  } else if (modal.kind === "delete") {
                    void lifecycle("delete", modal.caseId, reason.trim());
                  } else {
                    void bulkDeleteTestCases(modal.caseIds, reason.trim());
                  }
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                  modal.kind === "archive" ? "bg-slate-900 hover:bg-slate-800" : "bg-rose-700 hover:bg-rose-800"
                }`}
              >
                {busy
                  ? "Working..."
                  : modal.kind === "archive"
                    ? "Archive"
                    : modal.kind === "bulk_delete_tests"
                      ? `Soft-delete ${modal.caseIds.length}`
                      : "Soft-delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
