"use client";

import React, { useCallback, useMemo, useState } from "react";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ImageLightbox, { type LightboxUpload } from "@/components/uploads/ImageLightbox";
import {
  slotFromSurgeryType,
  getResolvedSurgeryChecklist,
  getRequiredPhotoCompletion,
  type ResolvedSurgerySlot,
} from "@/lib/surgeryUpload/checklist";
import { SURGERY_PROCEDURE_TYPES, type SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

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
}: {
  details: SurgeryUploadDetails;
  uploads: UploadRow[];
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
      />
      {optionalGroup.length > 0 && (
        <PhotoGroup
          title="Optional photos"
          slots={optionalGroup}
          uploadsBySlot={uploadsBySlot}
          onPreview={openPreview}
        />
      )}
      {additionalGroup.length > 0 && (
        <PhotoGroup
          title="Additional uploaded evidence"
          subtitle="Categories the clinic hid from new uploads, shown here because photos already exist."
          slots={additionalGroup}
          uploadsBySlot={uploadsBySlot}
          onPreview={openPreview}
        />
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
}: {
  title: string;
  subtitle?: string;
  slots: readonly ResolvedSurgerySlot[];
  uploadsBySlot: Record<string, UploadRow[]>;
  onPreview: (label: string, slotUploads: UploadRow[], index: number) => void;
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
          return (
            <div key={slot.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {slot.label}
                  <span className="ml-1 font-normal text-slate-500">— {status.countText}</span>
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}
                >
                  {status.label}
                </span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
