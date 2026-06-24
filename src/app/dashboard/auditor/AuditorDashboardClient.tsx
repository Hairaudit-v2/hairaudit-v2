"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuditorCaseQueueCard from "@/components/auditor/AuditorCaseQueueCard";
import {
  AUDITOR_QUEUE_FILTER_STORAGE_KEY,
  computeQueueSummaryCounts,
  deriveAuditorQueueCase,
  matchesQueueFilter,
  type AuditorQueueCaseInput,
  type AuditorQueueFilter,
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
  submission_channel?: string | null;
  visibility_scope?: string | null;
  patient_id?: string | null;
  doctor_id?: string | null;
  clinic_id?: string | null;
  assigned_auditor_id?: string | null;
  auditor_last_edited_at?: string | null;
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
  | { kind: "delete"; caseId: string; caseLabel: string }
  | { kind: "archive"; caseId: string; caseLabel: string }
  | { kind: "request_info"; caseId: string; caseLabel: string };

const FILTER_OPTIONS: Array<{ id: AuditorQueueFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_action", label: "Needs Action" },
  { id: "ready_to_audit", label: "Ready To Audit" },
  { id: "failed", label: "Failed" },
  { id: "missing_images", label: "Missing Images" },
  { id: "image_limited", label: "Image Limited" },
  { id: "completed", label: "Completed" },
  { id: "no_uploads", label: "No Uploads" },
];

const SUMMARY_CARD_DEFS = [
  { key: "newCases" as const, label: "New Cases", hint: "Submitted in last 24 hours", tone: "border-blue-200 bg-blue-50" },
  { key: "readyToAudit" as const, label: "Ready To Audit", hint: "Required images complete", tone: "border-emerald-200 bg-emerald-50" },
  { key: "incompleteSubmissions" as const, label: "Incomplete Submissions", hint: "Missing required images", tone: "border-orange-200 bg-orange-50" },
  { key: "failedProcessing" as const, label: "Failed Processing", hint: "AI / PDF / report failures", tone: "border-red-200 bg-red-50" },
  { key: "imageLimitedCases" as const, label: "Image Limited Cases", hint: "Document-assisted override", tone: "border-violet-200 bg-violet-50" },
  { key: "completedToday" as const, label: "Completed Today", hint: "Reports in last 24 hours", tone: "border-emerald-300 bg-emerald-100/60" },
];

function readPersistedFilter(): AuditorQueueFilter {
  if (typeof window === "undefined") return "needs_action";
  const stored = window.localStorage.getItem(AUDITOR_QUEUE_FILTER_STORAGE_KEY);
  if (stored && FILTER_OPTIONS.some((f) => f.id === stored)) return stored as AuditorQueueFilter;
  return "needs_action";
}

export default function AuditorDashboardClient(props: {
  cases: CaseRow[];
  reportByCase: Record<string, ReportRow>;
  evidenceByCase: Record<string, EvidenceRow>;
  assignedAuditorNameById: Record<string, string>;
  clinicNameByCaseId: Record<string, string>;
  patientNameByCaseId: Record<string, string>;
  patientEmailByCaseId: Record<string, string>;
  hasClinicalHistoryByCaseId: Record<string, boolean>;
  uploadStatsByCaseId: Record<string, UploadStats>;
}) {
  const router = useRouter();
  const [queueFilter, setQueueFilter] = useState<AuditorQueueFilter>("needs_action");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<ActionModalState>({ kind: "none" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyCaseId, setActionBusyCaseId] = useState<string | null>(null);

  useEffect(() => {
    setQueueFilter(readPersistedFilter());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUDITOR_QUEUE_FILTER_STORAGE_KEY, queueFilter);
    }
  }, [queueFilter]);

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
          updated_at: base.updated_at ?? base.auditor_last_edited_at ?? null,
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

  const summaryCounts = useMemo(() => computeQueueSummaryCounts(queueRows), [queueRows]);

  const searchFilteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return queueRows.filter((row) => {
      if (!q) return true;
      const { input, derived } = row;
      if (derived.isInactive && queueFilter !== "no_uploads" && !showInactive) return false;
      return (
        input.id.toLowerCase().includes(q) ||
        String(input.patientName ?? "").toLowerCase().includes(q) ||
        String(input.patientEmail ?? "").toLowerCase().includes(q) ||
        derived.caseNumberLabel.toLowerCase().includes(q) ||
        String(input.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [queueRows, search, queueFilter, showInactive]);

  const filteredRows = useMemo(() => {
    return searchFilteredRows
      .filter((row) => matchesQueueFilter(queueFilter, row))
      .sort((a, b) => {
        if (b.derived.priorityScore !== a.derived.priorityScore) {
          return b.derived.priorityScore - a.derived.priorityScore;
        }
        return new Date(b.input.submitted_at ?? b.input.created_at).getTime() -
          new Date(a.input.submitted_at ?? a.input.created_at).getTime();
      });
  }, [searchFilteredRows, queueFilter]);

  const actionRequiredRows = useMemo(() => {
    return searchFilteredRows
      .filter((row) => row.derived.needsAction && !row.derived.isInactive)
      .filter((row) => matchesQueueFilter(queueFilter, row) || queueFilter === "needs_action")
      .sort((a, b) => {
        if (a.derived.actionSortRank !== b.derived.actionSortRank) {
          return a.derived.actionSortRank - b.derived.actionSortRank;
        }
        return b.derived.priorityScore - a.derived.priorityScore;
      });
  }, [searchFilteredRows, queueFilter]);

  const failedRecoveryRows = useMemo(() => {
    return searchFilteredRows
      .filter((row) => row.derived.inFailedRecovery && !row.derived.isInactive)
      .sort((a, b) => b.derived.priorityScore - a.derived.priorityScore);
  }, [searchFilteredRows]);

  const inactiveRows = useMemo(() => {
    return searchFilteredRows
      .filter((row) => row.derived.isInactive)
      .sort((a, b) => new Date(b.input.created_at).getTime() - new Date(a.input.created_at).getTime());
  }, [searchFilteredRows]);

  const completedRows = useMemo(() => {
    return filteredRows.filter((row) => row.derived.badge === "COMPLETED");
  }, [filteredRows]);

  const mainQueueRows = useMemo(() => {
    if (queueFilter === "completed") return completedRows;
    if (queueFilter === "needs_action") return [];
    return filteredRows.filter((row) => !row.derived.isInactive && row.derived.badge !== "COMPLETED" && !row.derived.needsAction);
  }, [queueFilter, filteredRows, completedRows]);

  async function lifecycle(
    action:
      | "mark_in_progress"
      | "request_more_information"
      | "mark_needs_manual_review"
      | "suppress_public_visibility"
      | "archive"
      | "delete",
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
    reason: "failed_previous_run" | "auditor_review_request" | "document_assisted_image_limited"
  ) {
    setActionBusyCaseId(caseId);
    setError(null);
    try {
      const res = await fetch("/api/auditor/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action, reason, notes: null }),
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

  async function onOpenCase(caseId: string) {
    const ok = await lifecycle("mark_in_progress", caseId);
    if (ok) router.push(`/cases/${caseId}`);
  }

  const cardHandlers = {
    onOpenCase,
    onRegenerateAudit: (caseId: string) => void queueRerun(caseId, "regenerate_ai_audit", "auditor_review_request"),
    onRequestMissingImages: (caseId: string, label: string) => {
      setReason("");
      setModal({ kind: "request_info", caseId, caseLabel: label });
    },
    onMarkForReview: (caseId: string) => {
      void lifecycle("mark_needs_manual_review", caseId, "Marked for manual review from command center.");
    },
    onRetryFailedAudit: (caseId: string) => void queueRerun(caseId, "full_reaudit", "failed_previous_run"),
    onImageLimitedOverride: (caseId: string) =>
      void queueRerun(caseId, "full_reaudit", AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Auditor Case Queue</h1>
        <p className="text-slate-600 text-sm mt-1">
          Triage-first command center — action cases surface first, inactive submissions stay collapsed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        {SUMMARY_CARD_DEFS.map((card) => (
          <div key={card.key} className={`rounded-xl border p-3 ${card.tone}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summaryCounts[card.key]}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setQueueFilter(filter.id)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                queueFilter === filter.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient name, email, or case id"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {queueFilter !== "completed" && queueFilter !== "no_uploads" && (
        <section className="mb-8">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Action Required</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Failed, ready, new, incomplete, and processing cases — sorted by urgency.
            </p>
          </header>
          {actionRequiredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
              No cases need immediate action.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {actionRequiredRows.map((row) => (
                <AuditorCaseQueueCard
                  key={row.input.id}
                  input={row.input}
                  derived={row.derived}
                  clinicName={row.clinicName}
                  busy={busy || actionBusyCaseId === row.input.id}
                  {...cardHandlers}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {failedRecoveryRows.length > 0 && queueFilter !== "completed" && (
        <section className="mb-8 rounded-xl border border-red-200 bg-red-50/40 p-4">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-red-900">Failed Case Recovery</h2>
            <p className="text-sm text-red-700/80 mt-0.5">
              PDF, AI, missing-image, and classifier failures requiring intervention.
            </p>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {failedRecoveryRows.map((row) => (
              <AuditorCaseQueueCard
                key={`failed-${row.input.id}`}
                input={row.input}
                derived={row.derived}
                clinicName={row.clinicName}
                busy={busy || actionBusyCaseId === row.input.id}
                {...cardHandlers}
              />
            ))}
          </div>
        </section>
      )}

      {(queueFilter === "completed" || queueFilter === "no_uploads") && (
        <section className="mb-8">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {queueFilter === "completed" ? "Completed Audits" : "No Upload Cases"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{filteredRows.length} case(s)</p>
          </header>
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
              No cases match this filter.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRows.map((row) => (
                <AuditorCaseQueueCard
                  key={row.input.id}
                  input={row.input}
                  derived={row.derived}
                  clinicName={row.clinicName}
                  busy={busy || actionBusyCaseId === row.input.id}
                  {...cardHandlers}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {queueFilter !== "needs_action" && queueFilter !== "completed" && queueFilter !== "no_uploads" && (
        <section className="mb-8">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {queueFilter === "all" ? "All Active Cases" : "Filtered Queue"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{mainQueueRows.length} additional case(s)</p>
          </header>
          {mainQueueRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
              No cases match this filter.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mainQueueRows.map((row) => (
                <AuditorCaseQueueCard
                  key={row.input.id}
                  input={row.input}
                  derived={row.derived}
                  clinicName={row.clinicName}
                  busy={busy || actionBusyCaseId === row.input.id}
                  {...cardHandlers}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mb-8">
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-800">Show inactive cases</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Zero uploads, abandoned registration, or never submitted ({inactiveRows.length})
            </p>
          </div>
          <span className="text-sm text-slate-600">{showInactive ? "▲ Hide" : "▼ Show"}</span>
        </button>
        {showInactive && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {inactiveRows.length === 0 ? (
              <p className="text-sm text-slate-500 col-span-full text-center py-4">No inactive cases.</p>
            ) : (
              inactiveRows.map((row) => (
                <AuditorCaseQueueCard
                  key={`inactive-${row.input.id}`}
                  input={row.input}
                  derived={row.derived}
                  clinicName={row.clinicName}
                  compact
                  busy={busy || actionBusyCaseId === row.input.id}
                  {...cardHandlers}
                />
              ))
            )}
          </div>
        )}
      </section>

      {modal.kind !== "none" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4">
          <div className="mx-auto mt-24 max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              {modal.kind === "delete" ? "Confirm Safe Delete" : modal.kind === "archive" ? "Archive Case" : "Request Missing Images"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">Case: {modal.caseLabel}</p>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              placeholder={modal.kind === "delete" ? "Delete reason (required)" : "Optional reason"}
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
                disabled={busy || (modal.kind === "delete" && !reason.trim())}
                onClick={() => {
                  if (modal.kind === "delete") return void lifecycle("delete", modal.caseId, reason.trim());
                  if (modal.kind === "archive") return void lifecycle("archive", modal.caseId, reason.trim());
                  return void lifecycle("request_more_information", modal.caseId, reason.trim());
                }}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
