"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ImageLightbox, { type LightboxUpload } from "@/components/uploads/ImageLightbox";
import {
  slotFromSurgeryType,
  getResolvedSurgeryChecklist,
  getRequiredPhotoCompletion,
  type ResolvedSurgerySlot,
} from "@/lib/surgeryUpload/checklist";
import { SURGERY_PROCEDURE_TYPES, type SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import {
  EVIDENCE_REVIEW_ACTION_STATUSES,
  EVIDENCE_REVIEW_STATUS_LABELS,
  SLOT_REVIEW_ACTION_STATUSES,
  SLOT_REVIEW_STATUS_LABELS,
  evidenceReviewStatusLabel,
  slotReviewStatusLabel,
  type EvidenceReviewStatus,
  type SlotReviewStatus,
  type SurgerySlotReviewRow,
} from "@/lib/surgeryUpload/evidenceReview";
import SurgeryUploadEvidenceTimeline from "@/components/surgery-upload/SurgeryUploadEvidenceTimeline";
import SurgeryUploadEvidenceWorkspace, {
  computeEvidenceWorkspaceSummary,
} from "@/components/surgery-upload/SurgeryUploadEvidenceWorkspace";
import { type EvidenceTimelineEvent } from "@/lib/surgeryUpload/evidenceEvents";
import {
  AUDIT_HANDOFF_STATUS_LABELS,
  computeAuditHandoffEligibility,
  normalizeAuditHandoffStatus,
  type AuditHandoffStatus,
} from "@/lib/surgeryUpload/auditHandoff";
import {
  auditIntakePriorityLabel,
  auditIntakeStatusLabel,
  type AuditIntakePriority,
  type AuditIntakeStatus,
} from "@/lib/surgeryUpload/auditIntake";
import Link from "next/link";

/** Sanitized audit-intake view passed to the review panel (no internal ids). */
export type SurgeryAuditIntakeView = {
  status: AuditIntakeStatus;
  priority?: AuditIntakePriority | null;
  assignedLabel?: string | null;
  intakeNotes?: string | null;
};

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function hasLowResWarning(uploads: UploadRow[]): boolean {
  return uploads.some((u) => {
    const m = u.metadata as Record<string, unknown> | null;
    if (!m) return false;
    return Boolean(m.low_resolution) || Boolean(m.quality_warning) || m.resolution_flag === "low";
  });
}

const PROCEDURE_LABELS = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

function yesNo(v: boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

export default function SurgeryUploadReviewPanel({
  details,
  uploads,
  caseId,
  isAuditor = false,
  initialSlotReviews = [],
  evidenceEvents = [],
  auditIntake = null,
  evidenceReportPdfPath = null,
  evidenceReportRequestedByLabel = null,
}: {
  details: SurgeryUploadDetails;
  uploads: UploadRow[];
  caseId: string;
  isAuditor?: boolean;
  initialSlotReviews?: SurgerySlotReviewRow[];
  evidenceEvents?: EvidenceTimelineEvent[];
  auditIntake?: SurgeryAuditIntakeView | null;
  /** Stage 7B: storage path for generated evidence review PDF (forensic reports excluded). */
  evidenceReportPdfPath?: string | null;
  /** Stage 7C: display name for evidence_report_requested_by (resolved on server). */
  evidenceReportRequestedByLabel?: string | null;
}) {
  const surgeryUploads = useMemo(
    () => uploads.filter((u) => slotFromSurgeryType(u.type) !== null),
    [uploads]
  );

  const uploadsBySlot = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of surgeryUploads) {
      const slot = slotFromSurgeryType(u.type);
      if (!slot) continue;
      (map[slot] ||= []).push(u);
    }
    return map;
  }, [surgeryUploads]);

  // Resolve THIS case's checklist snapshot (null => base HairAudit checklist).
  const resolved = useMemo(
    () => getResolvedSurgeryChecklist(details.photo_checklist_config),
    [details.photo_checklist_config]
  );
  const requiredGroup = useMemo(() => resolved.filter((s) => s.effectiveRequired), [resolved]);
  const optionalGroup = useMemo(() => resolved.filter((s) => s.state === "optional"), [resolved]);
  // Hidden slots are normally omitted, but any that already have evidence must still
  // be surfaced to reviewers (never hide uploaded evidence).
  const additionalGroup = useMemo(
    () =>
      resolved.filter(
        (s) => s.state === "hidden" && (uploadsBySlot[s.key]?.length ?? 0) > 0
      ),
    [resolved, uploadsBySlot]
  );

  const completion = useMemo(
    () => getRequiredPhotoCompletion(surgeryUploads, details.photo_checklist_config),
    [surgeryUploads, details.photo_checklist_config]
  );
  const requiredTotal = completion.total;
  const requiredDone = completion.done;
  const submitted = details.status === "submitted";

  const requirementMessages = useMemo(
    () => completion.failures.map((f) => f.message),
    [completion.failures]
  );

  const evidenceWorkspaceSummary = useMemo(
    () => (isAuditor ? computeEvidenceWorkspaceSummary(details, uploads) : null),
    [isAuditor, details, uploads]
  );

  // Stage 5: per-slot reviewer decisions, keyed by slot_key.
  const [slotReviews, setSlotReviews] = useState<Record<string, SurgerySlotReviewRow>>(() => {
    const map: Record<string, SurgerySlotReviewRow> = {};
    for (const r of initialSlotReviews) map[r.slot_key] = r;
    return map;
  });

  const saveSlotReview = useCallback(
    async (slotKey: string, status: SlotReviewStatus, reviewerNotes: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/surgery-upload/cases/${caseId}/slot-review`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slotKey, status, reviewerNotes }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          slotReview?: SurgerySlotReviewRow;
        };
        if (!res.ok || !json.ok || !json.slotReview) return false;
        setSlotReviews((prev) => ({ ...prev, [slotKey]: json.slotReview! }));
        return true;
      } catch {
        return false;
      }
    },
    [caseId]
  );

  const [preview, setPreview] = useState<{
    upload: UploadRow;
    label: string;
    position: number;
    count: number;
  } | null>(null);

  const openPreview = useCallback(
    (label: string, slotUploads: UploadRow[], index: number) => {
      setPreview({
        upload: slotUploads[index],
        label,
        position: index + 1,
        count: slotUploads.length,
      });
    },
    []
  );

  const detailItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Procedure", value: details.procedure_type ? PROCEDURE_LABELS[details.procedure_type] ?? details.procedure_type : "—" },
    { label: "Surgery date", value: details.surgery_date ?? "—" },
    { label: "Surgeon", value: details.surgeon_name ?? "—" },
    {
      label: "Clinic",
      value: details.clinic_name ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>{details.clinic_name}</span>
          {details.clinic_profile_id && (
            <span
              className="rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700"
              title="This upload is linked to a clinic profile."
            >
              Linked clinic profile
            </span>
          )}
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Extraction machine", value: details.extraction_machine ?? "—" },
    { label: "Punch size", value: details.punch_size ?? "—" },
    { label: "Punch type", value: details.punch_type ?? "—" },
    { label: "Implantation method", value: details.implantation_method ?? "—" },
    { label: "PRP intra-op", value: yesNo(details.prp_used) },
    { label: "Exosomes", value: yesNo(details.exosomes_used) },
    { label: "Storage solution", value: details.storage_solution ?? "—" },
    { label: "Planned grafts", value: details.planned_grafts ?? "—" },
    { label: "Actual grafts", value: details.actual_grafts ?? "—" },
    { label: "Extraction start", value: details.extraction_start_time ?? "—" },
    { label: "Implantation start", value: details.implantation_start_time ?? "—" },
    { label: "Finish", value: details.surgery_finish_time ?? "—" },
  ];

  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            Mobile Surgery Upload
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              submitted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {submitted ? "Submitted for review" : "Draft"}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          Required photos: {requiredDone}/{requiredTotal}
        </span>
      </div>

      {submitted && details.submitted_at && (
        <p className="mt-1 text-xs text-slate-500">
          Submitted {new Date(details.submitted_at).toLocaleString()}
        </p>
      )}

      {/* Stage 5: overall evidence review (auditor controls / read-only feedback) */}
      {submitted && (
        <OverallReviewSection details={details} caseId={caseId} isAuditor={isAuditor} />
      )}

      {/* Stage 6B: controlled audit-pipeline handoff (auditor-only trigger). */}
      {submitted && (
        <AuditHandoffSection
          details={details}
          caseId={caseId}
          isAuditor={isAuditor}
          requiredEvidenceComplete={requirementMessages.length === 0}
          requirementMessages={requirementMessages}
        />
      )}

      {/* Stage 6C: audit intake queue status (once a record exists). */}
      {submitted && auditIntake && (
        <AuditIntakeStatusSection intake={auditIntake} isAuditor={isAuditor} />
      )}

      {/* Stage 8: auditor evidence review workspace (non-AI; never legacy case submission). */}
      {isAuditor && (
        <SurgeryUploadEvidenceWorkspace
          key={`evidence-workspace-${details.evidence_review_workspace_notes_updated_at ?? "n"}-${details.evidence_review_workspace_flags_updated_at ?? "f"}`}
          details={details}
          uploads={uploads}
          caseId={caseId}
        />
      )}

      {/* Stage 7B/7C: non-AI evidence review report (auditor-only; never legacy case submission). */}
      {isAuditor && (
        <EvidenceReviewReportSection
          caseId={caseId}
          submitted={submitted}
          details={details}
          pdfPath={evidenceReportPdfPath ?? null}
          requestedByLabel={evidenceReportRequestedByLabel ?? null}
          workspaceSummary={evidenceWorkspaceSummary}
        />
      )}

      {/* Required-photo completeness for reviewers (count-aware) */}
      {requirementMessages.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            Required photo minimums not met:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {requirementMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-800">
            Required photos complete: {requiredDone}/{requiredTotal}
          </p>
        </div>
      )}

      {/* Surgery details */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {detailItems.map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {item.label}
            </dt>
            <dd className="text-sm font-medium text-slate-800">{item.value}</dd>
          </div>
        ))}
      </dl>

      {(details.notes || details.complication_notes) && (
        <div className="mt-4 space-y-2">
          {details.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
              <p className="text-sm text-slate-700">{details.notes}</p>
            </div>
          )}
          {details.complication_notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Notes / complications
              </p>
              <p className="text-sm text-slate-700">{details.complication_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Photo groups in reviewer-friendly order: required → optional → hidden-with-evidence */}
      <PhotoGroup
        title="Required photos"
        slots={requiredGroup}
        uploadsBySlot={uploadsBySlot}
        onPreview={openPreview}
        showReviews={submitted}
        isAuditor={isAuditor}
        slotReviews={slotReviews}
        onSaveSlotReview={saveSlotReview}
      />
      {optionalGroup.length > 0 && (
        <PhotoGroup
          title="Optional photos"
          slots={optionalGroup}
          uploadsBySlot={uploadsBySlot}
          onPreview={openPreview}
          showReviews={submitted}
          isAuditor={isAuditor}
          slotReviews={slotReviews}
          onSaveSlotReview={saveSlotReview}
        />
      )}
      {additionalGroup.length > 0 && (
        <PhotoGroup
          title="Additional uploaded evidence"
          subtitle="Categories the clinic hid from new uploads, shown here because photos already exist."
          slots={additionalGroup}
          uploadsBySlot={uploadsBySlot}
          onPreview={openPreview}
          showReviews={submitted}
          isAuditor={isAuditor}
          slotReviews={slotReviews}
          onSaveSlotReview={saveSlotReview}
        />
      )}

      {/* Stage 6A: read-only evidence-review history (visible to all case participants) */}
      {submitted && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <SurgeryUploadEvidenceTimeline events={evidenceEvents} />
        </div>
      )}

      {preview && (
        <ImageLightbox
          upload={preview.upload as LightboxUpload}
          label={preview.label}
          position={preview.position}
          count={preview.count}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

/** Reviewer-facing per-slot status derived from the resolved checklist + counts. */
function slotStatus(
  slot: ResolvedSurgerySlot,
  count: number
): { label: string; cls: string; countText: string } {
  if (slot.state === "hidden") {
    return {
      label: "Hidden (has evidence)",
      cls: "bg-slate-200 text-slate-700",
      countText: `${count} ${count === 1 ? "image" : "images"}`,
    };
  }
  if (slot.effectiveRequired) {
    const met = count >= slot.requiredCount;
    return {
      label: met ? "Complete" : "Incomplete",
      cls: met ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
      countText: `${count}/${slot.requiredCount} required`,
    };
  }
  return {
    label: "Optional",
    cls: count > 0 ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-500",
    countText: `${count} ${count === 1 ? "image" : "images"}`,
  };
}

function PhotoGroup({
  title,
  subtitle,
  slots,
  uploadsBySlot,
  onPreview,
  showReviews = false,
  isAuditor = false,
  slotReviews = {},
  onSaveSlotReview,
}: {
  title: string;
  subtitle?: string;
  slots: readonly ResolvedSurgerySlot[];
  uploadsBySlot: Record<string, UploadRow[]>;
  onPreview: (label: string, slotUploads: UploadRow[], index: number) => void;
  showReviews?: boolean;
  isAuditor?: boolean;
  slotReviews?: Record<string, SurgerySlotReviewRow>;
  onSaveSlotReview?: (
    slotKey: string,
    status: SlotReviewStatus,
    reviewerNotes: string
  ) => Promise<boolean>;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-2 space-y-3">
        {slots.map((slot) => {
          const existing = uploadsBySlot[slot.key] ?? [];
          const count = existing.length;
          const status = slotStatus(slot, count);
          const review = slotReviews[slot.key] ?? null;
          const lowRes = hasLowResWarning(existing);
          return (
            <div key={slot.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {slot.label}
                  <span className="ml-1 font-normal text-slate-500">— {status.countText}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {review && review.status !== "not_reviewed" && (
                    <SlotReviewBadge status={review.status} />
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}
                  >
                    {status.label}
                  </span>
                </div>
              </div>
              {count > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {existing.map((u, i) => (
                    // locked => read-only (no delete control) for reviewers.
                    <UploadedThumb
                      key={u.id}
                      upload={u}
                      locked
                      onDeleted={() => {}}
                      onPreview={() => onPreview(slot.label, existing, i)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  No photos uploaded for this category.
                </p>
              )}
              {lowRes && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Low-resolution warning detected on one or more images. Review quality before accepting.
                </p>
              )}
              {showReviews &&
                (isAuditor && onSaveSlotReview ? (
                  <SlotReviewEditor
                    slotKey={slot.key}
                    review={review}
                    onSave={onSaveSlotReview}
                  />
                ) : (
                  <SlotReviewFeedback review={review} />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function slotBadgeClass(status: SlotReviewStatus): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-800";
    case "poor_quality":
      return "bg-rose-100 text-rose-800";
    case "needs_more_photos":
      return "bg-amber-100 text-amber-800";
    case "not_applicable":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function SlotReviewBadge({ status }: { status: SlotReviewStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slotBadgeClass(status)}`}>
      {slotReviewStatusLabel(status)}
    </span>
  );
}

/** Read-only per-slot feedback for clinic/doctor users. */
function SlotReviewFeedback({ review }: { review: SurgerySlotReviewRow | null }) {
  if (!review || review.status === "not_reviewed") return null;
  const emphasis =
    review.status === "poor_quality"
      ? "border-rose-200 bg-rose-50"
      : review.status === "needs_more_photos"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";
  return (
    <div className={`mt-2 rounded-lg border p-2 text-xs ${emphasis}`}>
      <p className="font-semibold text-slate-700">
        Reviewer: {slotReviewStatusLabel(review.status)}
      </p>
      {review.reviewer_notes && <p className="mt-0.5 text-slate-600">{review.reviewer_notes}</p>}
    </div>
  );
}

/** Auditor-only per-slot review editor. */
function SlotReviewEditor({
  slotKey,
  review,
  onSave,
}: {
  slotKey: string;
  review: SurgerySlotReviewRow | null;
  onSave: (slotKey: string, status: SlotReviewStatus, reviewerNotes: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<SlotReviewStatus>(review?.status ?? "not_reviewed");
  const [notes, setNotes] = useState<string>(review?.reviewer_notes ?? "");
  const [save, setSave] = useState<SaveState>("idle");

  const dirty =
    status !== (review?.status ?? "not_reviewed") || notes !== (review?.reviewer_notes ?? "");

  const handleSave = useCallback(async () => {
    if (status === "not_reviewed") return;
    setSave("saving");
    const ok = await onSave(slotKey, status, notes.trim());
    setSave(ok ? "saved" : "error");
    if (ok) setTimeout(() => setSave("idle"), 1500);
  }, [onSave, slotKey, status, notes]);

  return (
    <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600">Slot review</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SlotReviewStatus)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
        >
          <option value="not_reviewed">Not reviewed</option>
          {SLOT_REVIEW_ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SLOT_REVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || save === "saving" || status === "not_reviewed"}
          className="rounded-md bg-cyan-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {save === "saving" ? "Saving…" : "Save review"}
        </button>
        {save === "saved" && <span className="text-xs font-medium text-emerald-700">Saved</span>}
        {save === "error" && <span className="text-xs font-medium text-rose-700">Failed</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Reviewer notes (visible to clinic/doctor)"
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
      />
    </div>
  );
}

/**
 * Stage 7B/7C: auditor-only non-AI evidence review report (PDF) — UI + request entrypoint.
 *
 * REGRESSION GUARDS: only `POST /api/admin/hair-audit/surgery-upload/.../request-report`.
 * Never `/api/submit` or copy that implies a forensic case handoff.
 */
function EvidenceReviewReportSection({
  caseId,
  submitted,
  details,
  pdfPath,
  requestedByLabel,
  workspaceSummary,
}: {
  caseId: string;
  submitted: boolean;
  details: SurgeryUploadDetails;
  pdfPath: string | null;
  requestedByLabel: string | null;
  /** Stage 8: derived from workspace + uploads (no extra request buttons). */
  workspaceSummary: {
    completenessMet: number;
    completenessTotal: number;
    flagCount: number;
    lastReviewerNoteAt: string | null;
  } | null;
}) {
  const router = useRouter();
  const pipeline = details.evidence_report_pipeline_status ?? "not_started";
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<"idle" | "ok" | "err">("idle");
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const formatWhen = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return null;
    }
  };

  const requestOrRetryReport = async () => {
    setLoading(true);
    setBanner("idle");
    setLocalMsg(null);
    try {
      const res = await fetch(`/api/admin/hair-audit/surgery-upload/${caseId}/request-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !j.ok) {
        setBanner("err");
        setLocalMsg(j.error ?? "Request failed");
        return;
      }
      setBanner("ok");
      setLocalMsg(
        j.message ??
          "Non-AI evidence review report queued. It is generated in the background and does not start the forensic HairAudit pipeline."
      );
      router.refresh();
    } catch {
      setBanner("err");
      setLocalMsg("Network error");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!pdfPath) return;
    try {
      const res = await fetch(`/api/reports/signed-url?path=${encodeURIComponent(pdfPath)}`);
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        setBanner("err");
        setLocalMsg(j.error ?? "Could not get download URL");
        return;
      }
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch {
      setBanner("err");
      setLocalMsg("Download failed");
    }
  };

  const canRequestOrRetry =
    submitted && !loading && (pipeline === "not_started" || pipeline === "failed");

  const requestedAt = formatWhen(details.evidence_report_requested_at);
  const completedAt = formatWhen(details.evidence_report_completed_at);

  const statusHeadline = (() => {
    switch (pipeline) {
      case "not_started":
        return "Non-AI evidence review report: not requested yet.";
      case "queued":
        return "Non-AI evidence review report: requested — queued for generation.";
      case "running":
        return "Non-AI evidence review report: generation in progress.";
      case "succeeded":
        return "Non-AI evidence review report: ready.";
      case "failed":
        return "Non-AI evidence review report: generation failed.";
      case "cancelled":
        return "Non-AI evidence review report: cancelled.";
      default:
        return "Non-AI evidence review report: status unknown.";
    }
  })();

  const missingPdfWarning =
    pipeline === "succeeded" && (!pdfPath || pdfPath.trim() === "");

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
      <p className="text-sm font-semibold text-indigo-950">Non-AI evidence review report</p>
      <p className="mt-1 text-xs text-indigo-900/80">
        Optional PDF summarizing surgery-upload evidence and structured fields for internal review. This is{" "}
        <strong>not</strong> a forensic HairAudit scorecard and <strong>does not</strong> start the legacy audit
        engine.
      </p>

      {workspaceSummary && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-indigo-100 bg-white/70 px-2 py-1.5 text-[11px] text-indigo-950">
          <span>
            Workspace completeness:{" "}
            <strong>
              {workspaceSummary.completenessMet}/{workspaceSummary.completenessTotal}
            </strong>
          </span>
          <span className="text-indigo-300">|</span>
          <span>
            Flags: <strong>{workspaceSummary.flagCount}</strong>
          </span>
          <span className="text-indigo-300">|</span>
          <span>
            Last workspace note:{" "}
            <strong>{formatWhen(workspaceSummary.lastReviewerNoteAt) ?? "—"}</strong>
          </span>
          <Link
            href="#surgery-upload-evidence-workspace"
            className="ml-auto font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Open workspace ↑
          </Link>
        </div>
      )}

      <p className="mt-2 text-sm font-medium text-indigo-950">{statusHeadline}</p>

      {(requestedAt || requestedByLabel) && (
        <p className="mt-1 text-xs text-indigo-900/90">
          {requestedAt && <span>Requested: {requestedAt}</span>}
          {requestedAt && requestedByLabel && " · "}
          {requestedByLabel && <span>Requested by: {requestedByLabel}</span>}
        </p>
      )}
      {completedAt && pipeline === "succeeded" && (
        <p className="mt-1 text-xs text-indigo-900/90">Completed: {completedAt}</p>
      )}
      {pipeline === "failed" && details.evidence_report_error && (
        <p className="mt-1 text-xs text-rose-800">
          <span className="font-semibold">Details: </span>
          {String(details.evidence_report_error).slice(0, 500)}
        </p>
      )}

      {missingPdfWarning && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
          Report is marked ready, but no PDF path was found. Try refreshing; if this persists, contact support.
        </div>
      )}

      {banner === "ok" && localMsg && (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
          {localMsg}
        </p>
      )}
      {banner === "err" && localMsg && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-900">{localMsg}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canRequestOrRetry && (
          <button
            type="button"
            onClick={requestOrRetryReport}
            className="rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Working…"
              : pipeline === "failed"
                ? "Retry non-AI evidence review report"
                : "Request non-AI evidence review report"}
          </button>
        )}
        {pipeline === "succeeded" && pdfPath && (
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-900"
          >
            Download PDF
          </button>
        )}
      </div>

      {!submitted && (
        <p className="mt-2 text-xs text-slate-600">
          Available after the clinic finishes this surgery upload (mobile portal), so reviewers have a fixed evidence
          snapshot to summarize.
        </p>
      )}

      {(pipeline === "queued" || pipeline === "running") && (
        <p className="mt-2 text-xs text-indigo-800">
          {pipeline === "queued"
            ? "Queued — the non-AI evidence review report will generate shortly."
            : "In progress — PDF assembly is running; this page will update when finished."}
        </p>
      )}
    </div>
  );
}

/** Overall evidence review: auditor controls or read-only feedback. */
function OverallReviewSection({
  details,
  caseId,
  isAuditor,
}: {
  details: SurgeryUploadDetails;
  caseId: string;
  isAuditor: boolean;
}) {
  const initialStatus = (details.evidence_review_status as EvidenceReviewStatus) ?? "not_reviewed";
  const [status, setStatus] = useState<EvidenceReviewStatus>(
    initialStatus === "not_reviewed" ? "in_review" : initialStatus
  );
  const [notes, setNotes] = useState<string>(details.evidence_review_notes ?? "");
  const [requestMessage, setRequestMessage] = useState<string>(
    details.evidence_request_message ?? ""
  );
  const [currentStatus, setCurrentStatus] = useState<EvidenceReviewStatus>(initialStatus);
  const [savedNotes, setSavedNotes] = useState<string>(details.evidence_review_notes ?? "");
  const [savedMessage, setSavedMessage] = useState<string>(details.evidence_request_message ?? "");
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSave("saving");
    setError(null);
    try {
      const res = await fetch(`/api/surgery-upload/cases/${caseId}/evidence-review`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          evidenceReviewStatus: status,
          evidenceReviewNotes: notes.trim(),
          evidenceRequestMessage: status === "needs_more_evidence" ? requestMessage.trim() : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSave("error");
        setError(json.error ?? "Could not save review");
        return;
      }
      setCurrentStatus(status);
      setSavedNotes(notes.trim());
      if (status === "needs_more_evidence") setSavedMessage(requestMessage.trim());
      setSave("saved");
      setTimeout(() => setSave("idle"), 1500);
    } catch {
      setSave("error");
      setError("Could not save review");
    }
  }, [caseId, status, notes, requestMessage]);

  if (!isAuditor) {
    // Read-only feedback for clinic/doctor users.
    if (currentStatus === "not_reviewed") return null;
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">Evidence review</p>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {evidenceReviewStatusLabel(currentStatus)}
          </span>
        </div>
        {currentStatus === "needs_more_evidence" && savedMessage && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-xs font-semibold text-amber-900">Additional evidence requested:</p>
            <p className="mt-0.5 text-sm text-amber-900">{savedMessage}</p>
          </div>
        )}
        {savedNotes && (
          <div className="mt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Reviewer notes
            </p>
            <p className="text-sm text-slate-700">{savedNotes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-cyan-300 bg-cyan-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Evidence review (reviewer)</p>
        <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
          Current: {evidenceReviewStatusLabel(currentStatus)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EvidenceReviewStatus)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
        >
          {EVIDENCE_REVIEW_ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {EVIDENCE_REVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Reviewer notes (optional, visible to clinic/doctor)"
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
      />
      {status === "needs_more_evidence" && (
        <textarea
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          rows={2}
          placeholder="Request message — what additional evidence is needed?"
          className="mt-2 w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-slate-800"
        />
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={save === "saving"}
          className="rounded-md bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save === "saving" ? "Saving…" : "Save overall review"}
        </button>
        {save === "saved" && <span className="text-xs font-medium text-emerald-700">Saved</span>}
        {save === "error" && (
          <span className="text-xs font-medium text-rose-700">{error ?? "Failed"}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 6B: Audit pipeline handoff
// ---------------------------------------------------------------------------
function handoffBadgeClass(status: AuditHandoffStatus): string {
  switch (status) {
    case "sent":
      return "bg-indigo-100 text-indigo-800";
    case "sending":
      return "bg-amber-100 text-amber-800";
    case "failed":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function HandoffStatusBadge({ status }: { status: AuditHandoffStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${handoffBadgeClass(status)}`}
    >
      {AUDIT_HANDOFF_STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stage 6C: Audit intake queue status
// ---------------------------------------------------------------------------
function intakeBadgeClass(status: AuditIntakeStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "processing":
      return "bg-cyan-100 text-cyan-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
      return "bg-rose-100 text-rose-800";
    case "cancelled":
      return "bg-slate-200 text-slate-600";
  }
}

/**
 * Audit intake status. Auditors see priority, assignment, internal notes, and a
 * link to the queue. Clinic/doctor users see a read-only status only (no internal
 * notes, no error details, no internal ids).
 */
function AuditIntakeStatusSection({
  intake,
  isAuditor,
}: {
  intake: SurgeryAuditIntakeView;
  isAuditor: boolean;
}) {
  if (!isAuditor) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">Audit intake</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${intakeBadgeClass(intake.status)}`}
          >
            {auditIntakeStatusLabel(intake.status)}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Sent to audit intake. Audit intake status: {auditIntakeStatusLabel(intake.status)}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-purple-300 bg-purple-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Audit intake</p>
        <div className="flex items-center gap-1.5">
          {intake.priority && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {auditIntakePriorityLabel(intake.priority)}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${intakeBadgeClass(intake.status)}`}
          >
            {auditIntakeStatusLabel(intake.status)}
          </span>
        </div>
      </div>
      {intake.assignedLabel && (
        <p className="mt-1 text-xs text-slate-600">Assigned reviewer: {intake.assignedLabel}</p>
      )}
      {intake.intakeNotes && (
        <p className="mt-1.5 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
          {intake.intakeNotes}
        </p>
      )}
      <Link
        href="/dashboard/surgery-upload/audit-intake"
        className="mt-2 inline-flex text-xs font-semibold text-purple-700 hover:text-purple-800"
      >
        Manage in audit intake queue →
      </Link>
    </div>
  );
}

/**
 * Auditor-only "Send to Audit Pipeline" action + read-only status for clinic/doctor.
 *
 * Safety: this only marks the upload for audit intake (Stage 6B marker mode). The
 * server re-checks role, case access, submitted/ready_for_audit status, and required
 * evidence completeness — the client state here is never authoritative.
 */
function AuditHandoffSection({
  details,
  caseId,
  isAuditor,
  requiredEvidenceComplete,
  requirementMessages,
}: {
  details: SurgeryUploadDetails;
  caseId: string;
  isAuditor: boolean;
  requiredEvidenceComplete: boolean;
  requirementMessages: string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AuditHandoffStatus>(
    normalizeAuditHandoffStatus(details.audit_handoff_status)
  );
  const [notes, setNotes] = useState<string>(details.audit_handoff_notes ?? "");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(details.audit_handoff_error ?? null);

  const eligibility = useMemo(
    () =>
      computeAuditHandoffEligibility({
        status: details.status,
        evidenceReviewStatus: details.evidence_review_status,
        auditHandoffStatus: status,
        requiredEvidenceComplete,
      }),
    [details.status, details.evidence_review_status, status, requiredEvidenceComplete]
  );

  const sent = status === "sent";

  const handleSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/surgery-upload/cases/${caseId}/send-to-audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadySent?: boolean;
        auditHandoffStatus?: string;
        error?: string;
        requirementMessages?: string[];
      };
      if (res.ok && json.ok) {
        setStatus("sent");
        setConfirming(false);
        router.refresh();
        return;
      }
      // Surface a clear, specific reason. 422 carries requirement messages.
      const msg =
        json.requirementMessages && json.requirementMessages.length > 0
          ? json.requirementMessages.join(" ")
          : json.error ?? "Could not send to audit pipeline.";
      setError(msg);
      if (json.auditHandoffStatus === "failed") setStatus("failed");
      setConfirming(false);
    } catch {
      setError("Could not send to audit pipeline.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }, [caseId, notes, router]);

  // Read-only view for clinic/doctor: only surface a meaningful (sent/failed) state.
  if (!isAuditor) {
    if (status !== "sent" && status !== "failed") return null;
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">Audit pipeline handoff</p>
          <HandoffStatusBadge status={status} />
        </div>
        {status === "sent" && (
          <p className="mt-1 text-xs text-slate-500">
            This upload has been sent to the HairAudit audit intake.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-indigo-300 bg-indigo-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Audit pipeline handoff</p>
        <HandoffStatusBadge status={status} />
      </div>

      {sent ? (
        <p className="mt-2 text-sm font-medium text-indigo-800">
          Sent to audit intake. Audit processing is connected in a later stage; this
          upload is now queued for the HairAudit audit workflow.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-600">
            Hand this reviewed mobile surgery upload off to the HairAudit audit
            pipeline. This is deliberate and should only be done after evidence has
            been accepted.
          </p>

          {/* Eligibility checklist */}
          <ul className="mt-2 space-y-1">
            {eligibility.checklist.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    item.ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {item.ok ? "✓" : "•"}
                </span>
                <span className={item.ok ? "text-slate-700" : "text-slate-500"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          {!requiredEvidenceComplete && requirementMessages.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
              {requirementMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}

          {eligibility.eligible ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Handoff notes (optional)"
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={sending}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send to Audit Pipeline
                </button>
                {status === "failed" && (
                  <span className="text-xs font-medium text-slate-500">
                    Previous attempt failed — you can retry.
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
              {eligibility.reason}
            </p>
          )}
        </>
      )}

      {error && !sent && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Send to audit pipeline?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Send this mobile surgery upload to the HairAudit audit pipeline? This
              should only be done once the evidence has been reviewed and accepted.
            </p>
            {notes.trim() && (
              <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                {notes.trim()}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? "Sending…" : "Confirm & send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
