"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ImageLightbox, { type LightboxUpload } from "@/components/uploads/ImageLightbox";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import {
  EVIDENCE_ISSUE_FLAG_CODES,
  EVIDENCE_WORKSPACE_CATEGORY_LABEL,
  EVIDENCE_WORKSPACE_CATEGORY_ORDER,
  buildEvidenceCompletenessChecklist,
  deriveEvidenceReportReadiness,
  evidenceCompletenessRatio,
  evidenceIssueFlagLabel,
  groupUploadsByEvidenceWorkspaceCategory,
  parseEvidenceWorkspaceFlagsJson,
  type EvidenceIssueFlagCode,
  type EvidenceIssueFlagRow,
  type EvidenceWorkspaceUploadRow,
} from "@/lib/surgeryUpload/evidenceReviewWorkspace";

type UploadRow = EvidenceWorkspaceUploadRow;

function readinessStyles(kind: string): { bar: string; text: string } {
  switch (kind) {
    case "report_completed":
      return { bar: "border-emerald-200 bg-emerald-50", text: "text-emerald-900" };
    case "report_requested":
      return { bar: "border-indigo-200 bg-indigo-50", text: "text-indigo-950" };
    case "ready_for_evidence_report":
      return { bar: "border-cyan-200 bg-cyan-50", text: "text-cyan-950" };
    default:
      return { bar: "border-amber-200 bg-amber-50", text: "text-amber-950" };
  }
}

export default function SurgeryUploadEvidenceWorkspace({
  details,
  uploads,
  caseId,
}: {
  details: SurgeryUploadDetails;
  uploads: UploadRow[];
  caseId: string;
}) {
  const router = useRouter();
  const checklist = useMemo(() => buildEvidenceCompletenessChecklist(details, uploads), [details, uploads]);
  const ratio = useMemo(() => evidenceCompletenessRatio(checklist), [checklist]);
  const parsedFlags = useMemo(
    () => parseEvidenceWorkspaceFlagsJson(details.evidence_review_workspace_flags),
    [details.evidence_review_workspace_flags]
  );
  const readiness = useMemo(
    () =>
      deriveEvidenceReportReadiness({
        pipelineStatus: details.evidence_report_pipeline_status,
        checklistItems: checklist,
        flags: parsedFlags,
      }),
    [details.evidence_report_pipeline_status, checklist, parsedFlags]
  );

  const grouped = useMemo(() => groupUploadsByEvidenceWorkspaceCategory(uploads), [uploads]);

  const [notes, setNotes] = useState(details.evidence_review_workspace_notes ?? "");
  const [selectedCodes, setSelectedCodes] = useState<Set<EvidenceIssueFlagCode>>(() => new Set(parsedFlags.map((f) => f.code)));
  const [otherDetail, setOtherDetail] = useState(
    () => parsedFlags.find((f) => f.code === "other")?.detail ?? ""
  );
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const buildFlagsPayload = useCallback((): EvidenceIssueFlagRow[] => {
    const rows: EvidenceIssueFlagRow[] = [];
    for (const code of EVIDENCE_ISSUE_FLAG_CODES) {
      if (!selectedCodes.has(code)) continue;
      if (code === "other") {
        rows.push({ code: "other", detail: otherDetail.trim() });
      } else {
        rows.push({ code });
      }
    }
    return rows;
  }, [selectedCodes, otherDetail]);

  const dirty = useMemo(() => {
    const serverNotes = details.evidence_review_workspace_notes ?? "";
    const serverFlags = parseEvidenceWorkspaceFlagsJson(details.evidence_review_workspace_flags);
    const serverSet = new Set(serverFlags.map((f) => f.code));
    const notesDirty = notes.trim() !== serverNotes.trim();
    if (notesDirty) return true;
    if (selectedCodes.size !== serverSet.size) return true;
    for (const c of selectedCodes) if (!serverSet.has(c)) return true;
    const prevOther = serverFlags.find((f) => f.code === "other")?.detail ?? "";
    if (selectedCodes.has("other") && otherDetail.trim() !== prevOther.trim()) return true;
    return false;
  }, [notes, selectedCodes, otherDetail, details.evidence_review_workspace_notes, details.evidence_review_workspace_flags]);

  const saveWorkspace = async () => {
    setSave("saving");
    setError(null);
    try {
      const body: Record<string, unknown> = { notes, flags: buildFlagsPayload() };
      const res = await fetch(`/api/admin/hair-audit/surgery-upload/${caseId}/evidence-workspace`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setSave("error");
        setError(j.error ?? "Save failed");
        return;
      }
      setSave("saved");
      router.refresh();
      setTimeout(() => setSave("idle"), 1200);
    } catch {
      setSave("error");
      setError("Network error");
    }
  };

  const [preview, setPreview] = useState<{
    upload: UploadRow;
    label: string;
    position: number;
    count: number;
  } | null>(null);

  const rs = readinessStyles(readiness.kind);

  return (
    <div id="surgery-upload-evidence-workspace" className="mt-4 rounded-xl border border-slate-300 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Evidence review workspace</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Internal auditor tools for the non-AI evidence review report. Does not submit the case to the forensic audit
            pipeline.
          </p>
        </div>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
          Auditor only
        </span>
      </div>

      <div className={`mt-3 rounded-lg border px-3 py-2 ${rs.bar}`}>
        <p className={`text-sm font-semibold ${rs.text}`}>{readiness.headline}</p>
        {readiness.detail && <p className={`mt-0.5 text-xs ${rs.text}`}>{readiness.detail}</p>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completeness</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {ratio.met}/{ratio.total}
          </p>
          <p className="text-xs text-slate-500">Administrative items (excludes optional punch row).</p>
        </div>
        <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace flags</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{parsedFlags.length}</p>
          <p className="text-xs text-slate-500">Issue markers for this review (included in the PDF).</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Evidence completeness checklist</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {checklist.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 py-1.5 text-sm">
              <span className="text-slate-700">{row.label}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  row.met ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                }`}
              >
                {row.met ? "Yes" : "No"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-lg border border-white bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Evidence by category</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Grouped from upload types and slot metadata. Consent/documentation includes non-photo types that look like
          documents when present.
        </p>
        <div className="mt-3 space-y-4">
          {EVIDENCE_WORKSPACE_CATEGORY_ORDER.map((cat) => {
            const list = grouped[cat];
            if (list.length === 0) return null;
            const label = EVIDENCE_WORKSPACE_CATEGORY_LABEL[cat];
            return (
              <div key={cat} className="rounded-lg border border-slate-100 p-2">
                <p className="text-xs font-semibold text-slate-700">
                  {label}{" "}
                  <span className="font-normal text-slate-500">
                    ({list.length} {list.length === 1 ? "file" : "files"})
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {list.map((u, i) => (
                    <UploadedThumb
                      key={u.id}
                      upload={u}
                      locked
                      onDeleted={() => {}}
                      onPreview={() =>
                        setPreview({
                          upload: u,
                          label: `${label} · ${u.type}`,
                          position: i + 1,
                          count: list.length,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Reviewer notes (workspace)</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Saved separately from clinic-facing evidence review notes. Included in the non-AI evidence review PDF.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          placeholder="Structured observations for internal evidence review…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={
              !dirty ||
              save === "saving" ||
              (selectedCodes.has("other") && !otherDetail.trim())
            }
            onClick={() => void saveWorkspace()}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {save === "saving" ? "Saving…" : "Save notes & flags"}
          </button>
          {save === "saved" && <span className="text-xs font-medium text-emerald-700">Saved</span>}
          {save === "error" && <span className="text-xs font-medium text-rose-700">{error ?? "Error"}</span>}
        </div>
        {(details.evidence_review_workspace_notes_updated_at ||
          details.evidence_review_workspace_notes_updated_by) && (
          <p className="mt-2 text-[11px] text-slate-500">
            Last note update:{" "}
            {details.evidence_review_workspace_notes_updated_at
              ? new Date(details.evidence_review_workspace_notes_updated_at).toLocaleString()
              : "—"}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-white bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Evidence issues / flags</p>
        <div className="mt-2 space-y-2">
          {EVIDENCE_ISSUE_FLAG_CODES.map((code) => (
            <label key={code} className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selectedCodes.has(code)}
                onChange={(e) => {
                  setSelectedCodes((prev) => {
                    const n = new Set(prev);
                    if (e.target.checked) n.add(code);
                    else n.delete(code);
                    return n;
                  });
                }}
              />
              <span>{evidenceIssueFlagLabel(code)}</span>
            </label>
          ))}
          {selectedCodes.has("other") && (
            <input
              type="text"
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              placeholder="Describe the “other” issue (required when checked)"
              className="w-full rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1 text-sm text-slate-900"
            />
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Flags are administrative only; they do not change mobile portal submission state.
        </p>
      </div>

      {preview && (
        <ImageLightbox
          upload={preview.upload as LightboxUpload}
          label={preview.label}
          position={preview.position}
          count={preview.count}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

export function computeEvidenceWorkspaceSummary(details: SurgeryUploadDetails, uploads: UploadRow[]) {
  const checklist = buildEvidenceCompletenessChecklist(details, uploads);
  const ratio = evidenceCompletenessRatio(checklist);
  const flags = parseEvidenceWorkspaceFlagsJson(details.evidence_review_workspace_flags);
  return {
    completenessMet: ratio.met,
    completenessTotal: ratio.total,
    flagCount: flags.length,
    lastReviewerNoteAt: details.evidence_review_workspace_notes_updated_at ?? null,
  };
}
