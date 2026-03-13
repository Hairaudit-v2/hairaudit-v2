"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AuditType = "patient" | "doctor" | "clinic";
type SectionStatus = "requires_action" | "ready" | "in_progress" | "completed";

type CaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  submitted_at?: string | null;
  audit_type: AuditType | null;
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

type GiiRow = {
  case_id: string;
  confidence: number;
  confidence_label: "low" | "medium" | "high";
  evidence_sufficiency_score?: number | null;
  auditor_status: "pending" | "approved" | "rejected" | "needs_more_evidence";
  audited_by?: string | null;
  audited_at?: string | null;
  created_at?: string | null;
};

type CaseFlags = {
  missingEvidence: boolean;
  lowAiConfidence: boolean;
  auditorInputRequired: boolean;
  staleCase: boolean;
};

type DashboardCase = {
  base: CaseRow;
  report: ReportRow | null;
  evidence: EvidenceRow | null;
  gii: GiiRow | null;
  clinicName: string | null;
  patientName: string | null;
  assignedAuditorName: string | null;
  flags: CaseFlags;
  section: SectionStatus;
  submissionDate: string;
  lastEdited: string;
};

type ActionModalState =
  | { kind: "none" }
  | { kind: "delete"; caseId: string; caseLabel: string }
  | { kind: "archive"; caseId: string; caseLabel: string }
  | { kind: "request_info"; caseId: string; caseLabel: string };

function toIsoOrEmpty(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function pct(v: number | null | undefined) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function getSummaryNeedsMoreEvidence(summary: Record<string, unknown> | null | undefined) {
  const auditorReview = (summary?.auditor_review ?? null) as Record<string, unknown> | null;
  return Boolean(auditorReview?.needs_more_evidence);
}

function getDefaultAuditType(c: CaseRow): AuditType {
  if (c.audit_type === "doctor" || c.audit_type === "clinic" || c.audit_type === "patient") return c.audit_type;
  if (c.clinic_id) return "clinic";
  if (c.doctor_id) return "doctor";
  return "patient";
}

function deriveFlags(input: {
  caseRow: CaseRow;
  report: ReportRow | null;
  evidence: EvidenceRow | null;
  gii: GiiRow | null;
  nowMs: number;
}) {
  const missingEvidence = !input.evidence || (input.evidence.missing_categories?.length ?? 0) > 0;
  const lowAiConfidence = !!input.gii && Number(input.gii.confidence) < 0.65;
  const needsMoreEvidence = getSummaryNeedsMoreEvidence(input.report?.summary);
  const giiNeedsInput = input.gii?.auditor_status === "pending" || input.gii?.auditor_status === "needs_more_evidence";
  const manualFailed = String(input.caseRow.status ?? "") === "audit_failed";
  const auditorInputRequired = manualFailed || needsMoreEvidence || giiNeedsInput;

  const lastActivity = new Date(
    input.caseRow.auditor_last_edited_at ?? input.caseRow.updated_at ?? input.caseRow.submitted_at ?? input.caseRow.created_at
  ).getTime();
  const staleCase = Number.isFinite(lastActivity) ? input.nowMs - lastActivity > 1000 * 60 * 60 * 24 * 7 : false;

  return { missingEvidence, lowAiConfidence, auditorInputRequired, staleCase };
}

function flagLabels(flags: CaseFlags) {
  const out: string[] = [];
  if (flags.missingEvidence) out.push("⚠ Missing Evidence");
  if (flags.lowAiConfidence) out.push("⚠ Low AI Confidence");
  if (flags.auditorInputRequired) out.push("⚠ Auditor Input Required");
  if (flags.staleCase) out.push("⚠ Stale Case");
  return out;
}

function classifySection(input: {
  caseRow: CaseRow;
  report: ReportRow | null;
  evidence: EvidenceRow | null;
  gii: GiiRow | null;
  flags: CaseFlags;
}) {
  const reportStatus = String(input.report?.status ?? "");
  const reportReview = String(input.report?.auditor_review_status ?? "");
  const isCompleted =
    String(input.caseRow.status ?? "") === "complete" ||
    reportReview === "completed" ||
    input.gii?.auditor_status === "approved";
  if (isCompleted) return "completed" as const;

  const inProgress =
    !!input.caseRow.assigned_auditor_id &&
    (!!input.caseRow.auditor_last_edited_at || reportReview === "in_review");

  const evidenceComplete = !!input.evidence && (input.evidence.missing_categories?.length ?? 0) === 0;
  const aiFinished = reportStatus === "complete" || !!input.gii;
  const intakeComplete = ["submitted", "processing", "complete", "audit_failed"].includes(String(input.caseRow.status ?? ""));
  const readyForReview = intakeComplete && evidenceComplete && aiFinished;

  if (input.flags.missingEvidence || input.flags.lowAiConfidence || input.flags.auditorInputRequired || input.flags.staleCase) {
    return "requires_action" as const;
  }
  if (readyForReview) return "ready" as const;
  if (inProgress) return "in_progress" as const;
  return "ready" as const;
}

function CaseRowView({
  row,
  onOpenAudit,
  onRequestInfo,
  onArchive,
  onDelete,
}: {
  row: DashboardCase;
  onOpenAudit: (caseId: string) => void;
  onRequestInfo: (caseId: string, label: string) => void;
  onArchive: (caseId: string, label: string) => void;
  onDelete: (caseId: string, label: string) => void;
}) {
  const labels = flagLabels(row.flags);
  const evidenceMissing = row.evidence?.missing_categories?.length ?? 0;
  const evidenceScore = row.evidence?.quality_score ?? row.gii?.evidence_sufficiency_score ?? null;
  const caseLabel = row.base.title ?? row.id.slice(0, 8);

  return (
    <tr className="border-b border-slate-200 align-top">
      <td className="px-3 py-3 font-mono text-xs text-slate-700">{row.base.id.slice(0, 8)}…</td>
      <td className="px-3 py-3 text-sm text-slate-800 capitalize">{getDefaultAuditType(row.base)}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{formatDate(row.submissionDate)}</td>
      <td className="px-3 py-3 text-sm">
        <div className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{row.section.replaceAll("_", " ")}</div>
        {row.section === "in_progress" && (
          <div className="mt-1 text-xs text-slate-500">Last edited: {formatDate(row.lastEdited)}</div>
        )}
        {labels.length > 0 && (
          <div className="mt-1 space-y-1">
            {labels.slice(0, 2).map((x) => (
              <div key={x} className="text-xs text-amber-700">
                {x}
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-slate-700">{pct(row.gii?.confidence)}</td>
      <td className="px-3 py-3 text-sm text-slate-700">
        {typeof evidenceScore === "number" ? Math.round(evidenceScore) : "—"}
        {evidenceMissing > 0 ? ` (${evidenceMissing} missing)` : ""}
      </td>
      <td className="px-3 py-3 text-sm text-slate-700">{row.assignedAuditorName ?? "Unassigned"}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenAudit(row.base.id)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            Open Audit
          </button>
          <button
            type="button"
            onClick={() => onRequestInfo(row.base.id, caseLabel)}
            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
          >
            Request More Information
          </button>
          <button
            type="button"
            onClick={() => onArchive(row.base.id, caseLabel)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => onDelete(row.base.id, caseLabel)}
            className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AuditorDashboardClient(props: {
  cases: CaseRow[];
  reportByCase: Record<string, ReportRow>;
  evidenceByCase: Record<string, EvidenceRow>;
  giiByCase: Record<string, GiiRow>;
  assignedAuditorNameById: Record<string, string>;
  clinicNameByCaseId: Record<string, string>;
  patientNameByCaseId: Record<string, string>;
}) {
  const router = useRouter();
  const [auditTypeTab, setAuditTypeTab] = useState<"all" | AuditType>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SectionStatus>("all");
  const [auditTypeFilter, setAuditTypeFilter] = useState<"" | AuditType>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [modal, setModal] = useState<ActionModalState>({ kind: "none" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRows = useMemo(() => {
    const nowMs = Date.now();
    const list: DashboardCase[] = props.cases.map((base) => {
      const report = props.reportByCase[base.id] ?? null;
      const evidence = props.evidenceByCase[base.id] ?? null;
      const gii = props.giiByCase[base.id] ?? null;
      const flags = deriveFlags({ caseRow: base, report, evidence, gii, nowMs });
      const section = classifySection({ caseRow: base, report, evidence, gii, flags });
      const submissionDate = base.submitted_at ?? base.created_at;
      const lastEdited = base.auditor_last_edited_at ?? base.updated_at ?? report?.created_at ?? base.created_at;
      return {
        base,
        report,
        evidence,
        gii,
        clinicName: props.clinicNameByCaseId[base.id] ?? null,
        patientName: props.patientNameByCaseId[base.id] ?? null,
        assignedAuditorName: base.assigned_auditor_id ? props.assignedAuditorNameById[base.assigned_auditor_id] ?? null : null,
        flags,
        section,
        submissionDate,
        lastEdited,
      };
    });
    return list.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
  }, [props]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      const caseType = getDefaultAuditType(row.base);
      const inTab = auditTypeTab === "all" || caseType === auditTypeTab;
      if (!inTab) return false;

      if (statusFilter !== "all" && row.section !== statusFilter) return false;
      if (auditTypeFilter && caseType !== auditTypeFilter) return false;

      const text = search.trim().toLowerCase();
      if (text) {
        const match =
          row.base.id.toLowerCase().includes(text) ||
          String(row.clinicName ?? "").toLowerCase().includes(text) ||
          String(row.patientName ?? "").toLowerCase().includes(text);
        if (!match) return false;
      }

      if (assignedFilter) {
        if (assignedFilter === "__unassigned__") {
          if (row.base.assigned_auditor_id) return false;
        } else if (row.base.assigned_auditor_id !== assignedFilter) {
          return false;
        }
      }

      const fromIso = toIsoOrEmpty(dateFrom);
      const toIso = toIsoOrEmpty(dateTo);
      const submissionMs = new Date(row.submissionDate).getTime();
      if (fromIso && submissionMs < new Date(fromIso).getTime()) return false;
      if (toIso && submissionMs > new Date(toIso).getTime() + 1000 * 60 * 60 * 24) return false;

      return true;
    });
  }, [allRows, auditTypeTab, statusFilter, auditTypeFilter, search, dateFrom, dateTo, assignedFilter]);

  const activeRows = filteredRows.filter((r) => !r.base.archived_at);
  const archiveRows = filteredRows.filter((r) => !!r.base.archived_at);

  const requiresAction = activeRows.filter((r) => r.section === "requires_action");
  const ready = activeRows.filter((r) => r.section === "ready");
  const inProgress = activeRows.filter((r) => r.section === "in_progress");
  const completed = activeRows.filter((r) => r.section === "completed");

  const archiveSearchRows = archiveRows.filter((r) => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.base.id.toLowerCase().includes(q) ||
      String(r.clinicName ?? "").toLowerCase().includes(q) ||
      String(r.patientName ?? "").toLowerCase().includes(q)
    );
  });

  const assignedOptions = useMemo(() => {
    const ids = Array.from(new Set(props.cases.map((x) => x.assigned_auditor_id).filter(Boolean))) as string[];
    return ids.map((id) => ({ id, name: props.assignedAuditorNameById[id] ?? id.slice(0, 8) }));
  }, [props.cases, props.assignedAuditorNameById]);

  async function lifecycle(
    action: "mark_in_progress" | "request_more_information" | "archive" | "delete",
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

  async function onOpenAudit(caseId: string) {
    const ok = await lifecycle("mark_in_progress", caseId);
    if (ok) router.push(`/cases/${caseId}`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auditor Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">Prioritized queues for manual review and case lifecycle actions.</p>
        </div>
        <Link
          href="/admin/contribution-requests"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Contribution Requests →
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "patient", "doctor", "clinic"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAuditTypeTab(type)}
              className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${
                auditTypeTab === type ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case ID / clinic name / patient name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | SectionStatus)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Status: All</option>
            <option value="requires_action">Requires Action</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select value={auditTypeFilter} onChange={(e) => setAuditTypeFilter(e.target.value as "" | AuditType)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Audit Type: All</option>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
            <option value="clinic">Clinic</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Assigned Auditor: All</option>
            <option value="__unassigned__">Unassigned</option>
            {assignedOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {[
        { title: "Requires Auditor Action", rows: requiresAction },
        { title: "Ready for Review", rows: ready },
        { title: "In Progress", rows: inProgress },
        { title: "Completed Audits", rows: completed },
      ].map((section) => (
        <section key={section.title} className="mb-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{section.rows.length} case(s)</p>
          </div>
          {section.rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">No cases in this section.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Case ID</th>
                    <th className="px-3 py-2">Audit Type</th>
                    <th className="px-3 py-2">Submission Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Confidence Score</th>
                    <th className="px-3 py-2">Evidence Completeness</th>
                    <th className="px-3 py-2">Assigned Auditor</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <CaseRowView
                      key={row.base.id}
                      row={row}
                      onOpenAudit={onOpenAudit}
                      onRequestInfo={(caseId, label) => {
                        setReason("");
                        setModal({ kind: "request_info", caseId, caseLabel: label });
                      }}
                      onArchive={(caseId, label) => {
                        setReason("");
                        setModal({ kind: "archive", caseId, caseLabel: label });
                      }}
                      onDelete={(caseId, label) => {
                        setReason("");
                        setModal({ kind: "delete", caseId, caseLabel: label });
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Archive</h2>
          <p className="text-xs text-slate-500 mt-1">Archived cases are removed from the main queues but remain searchable here.</p>
        </div>
        <div className="p-4 border-b border-slate-200">
          <input
            value={archiveSearch}
            onChange={(e) => setArchiveSearch(e.target.value)}
            placeholder="Search archive by case ID / clinic name / patient name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {archiveSearchRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No archived cases found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Case ID</th>
                  <th className="px-3 py-2">Audit Type</th>
                  <th className="px-3 py-2">Submission Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Confidence Score</th>
                  <th className="px-3 py-2">Evidence Completeness</th>
                  <th className="px-3 py-2">Assigned Auditor</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archiveSearchRows.map((row) => (
                  <tr key={row.base.id} className="border-b border-slate-200 align-top">
                    <td className="px-3 py-3 font-mono text-xs text-slate-700">{row.base.id.slice(0, 8)}…</td>
                    <td className="px-3 py-3 text-sm text-slate-800 capitalize">{getDefaultAuditType(row.base)}</td>
                    <td className="px-3 py-3 text-sm text-slate-700">{formatDate(row.submissionDate)}</td>
                    <td className="px-3 py-3 text-sm text-slate-700">Archived</td>
                    <td className="px-3 py-3 text-sm text-slate-700">{pct(row.gii?.confidence)}</td>
                    <td className="px-3 py-3 text-sm text-slate-700">{typeof row.evidence?.quality_score === "number" ? Math.round(row.evidence.quality_score) : "—"}</td>
                    <td className="px-3 py-3 text-sm text-slate-700">{row.assignedAuditorName ?? "Unassigned"}</td>
                    <td className="px-3 py-3">
                      <Link href={`/cases/${row.base.id}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50">
                        Open Audit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal.kind !== "none" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4">
          <div className="mx-auto mt-24 max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              {modal.kind === "delete" ? "Confirm Safe Delete" : modal.kind === "archive" ? "Archive Case" : "Request More Information"}
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
