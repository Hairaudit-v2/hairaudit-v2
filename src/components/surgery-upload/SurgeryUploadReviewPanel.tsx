"use client";

import React, { useMemo } from "react";
import UploadedThumb from "@/components/uploads/UploadedThumb";
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

  const missingRequiredLabels = useMemo(() => {
    const labelByKey = new Map(resolved.map((s) => [s.key, s.label]));
    return completion.missing.map((key) => labelByKey.get(key) ?? key);
  }, [completion.missing, resolved]);

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

      {/* Required-photo completeness for reviewers */}
      {missingRequiredLabels.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            Missing required photos:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {missingRequiredLabels.map((label) => (
              <li key={label}>{label}</li>
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
      <PhotoGroup title="Required photos" slots={requiredGroup} uploadsBySlot={uploadsBySlot} />
      {optionalGroup.length > 0 && (
        <PhotoGroup title="Optional photos" slots={optionalGroup} uploadsBySlot={uploadsBySlot} />
      )}
      {additionalGroup.length > 0 && (
        <PhotoGroup
          title="Additional uploaded evidence"
          subtitle="Categories the clinic hid from new uploads, shown here because photos already exist."
          slots={additionalGroup}
          uploadsBySlot={uploadsBySlot}
        />
      )}
    </section>
  );
}

function PhotoGroup({
  title,
  subtitle,
  slots,
  uploadsBySlot,
}: {
  title: string;
  subtitle?: string;
  slots: readonly ResolvedSurgerySlot[];
  uploadsBySlot: Record<string, UploadRow[]>;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-2 space-y-3">
        {slots.map((slot) => {
          const existing = uploadsBySlot[slot.key] ?? [];
          const count = existing.length;
          return (
            <div key={slot.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {slot.label}
                  {slot.effectiveRequired && (
                    <span className="ml-1 text-xs text-amber-700">(required)</span>
                  )}
                  <span className="ml-1 font-normal text-slate-500">
                    — {count} {count === 1 ? "image" : "images"}
                  </span>
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    count > 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </div>
              {count > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {existing.map((u) => (
                    // locked => read-only (no delete control) for reviewers.
                    <UploadedThumb key={u.id} upload={u} locked onDeleted={() => {}} />
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
