"use client";

import React, { useState } from "react";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import { isExtendedPatientUploadsEnabled } from "@/lib/features/enableExtendedPatientUploads";
import type { PatientUploadCategoryKey } from "@/lib/patientPhotoCategoryConfig";
import {
  getPatientExtendedUploadGroupsResolved,
  PATIENT_EXTENDED_UPLOAD_MICROCOPY,
} from "@/lib/patientExtendedUploadUi";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: unknown;
  created_at: string;
};

type Skin = "audit" | "legacy";

function acceptsImage(file: File, accept: string): boolean {
  if (!accept || accept === "*/*" || accept === "image/*") return file.type.startsWith("image/");
  return file.type.startsWith("image/");
}

export default function ExtendedPatientPhotoUploadGroups({
  enabled: enabledProp,
  locked,
  busyCats,
  uploadsByCategory,
  onUpload,
  onDeleted,
  skin = "audit",
}: {
  /** When unset, uses NEXT_PUBLIC_ENABLE_EXTENDED_PATIENT_UPLOADS. */
  enabled?: boolean;
  locked: boolean;
  busyCats: Record<string, boolean>;
  uploadsByCategory: Record<string, UploadRow[]>;
  onUpload: (category: PatientUploadCategoryKey, files: File[]) => void;
  onDeleted: (uploadId: string) => void;
  skin?: Skin;
}) {
  const enabled = enabledProp ?? isExtendedPatientUploadsEnabled();
  if (!enabled) return null;

  const groups = getPatientExtendedUploadGroupsResolved();
  const shell =
    skin === "audit"
      ? "rounded-xl border border-slate-200 bg-slate-50/40"
      : "rounded-xl border border-gray-200 bg-gray-50/50";
  const summaryCls =
    skin === "audit"
      ? "cursor-pointer list-none px-4 py-3 font-medium text-slate-800 hover:bg-slate-100/80 [&::-webkit-details-marker]:hidden"
      : "cursor-pointer list-none px-4 py-3 font-medium text-gray-800 hover:bg-gray-100/80 [&::-webkit-details-marker]:hidden";

  return (
    <section className={`mt-8 space-y-4 ${skin === "audit" ? "border-t border-slate-200 pt-8" : "border-t border-gray-200 pt-8"}`}>
      <div className={`rounded-lg p-4 ${shell}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${skin === "audit" ? "text-slate-500" : "text-gray-500"}`}>
          {PATIENT_EXTENDED_UPLOAD_MICROCOPY.eyebrow}
        </p>
        <p className={`mt-1 text-sm ${skin === "audit" ? "text-slate-700" : "text-gray-700"}`}>
          {PATIENT_EXTENDED_UPLOAD_MICROCOPY.body}
        </p>
      </div>

      {groups.map((group) => (
        <details key={group.id} className={`group ${shell}`}>
          <summary className={summaryCls}>
            <span className="flex items-center justify-between gap-2">
              <span>
                {group.title}{" "}
                <span className={`text-xs font-normal ${skin === "audit" ? "text-slate-500" : "text-gray-500"}`}>
                  (optional)
                </span>
              </span>
              <span aria-hidden className="text-slate-400 text-sm transition group-open:rotate-90">
                ▸
              </span>
            </span>
            <span className={`mt-1 block text-xs font-normal ${skin === "audit" ? "text-slate-600" : "text-gray-600"}`}>
              {group.groupDescription}
            </span>
          </summary>

          <div className="space-y-4 border-t border-slate-200/80 px-3 py-4">
            {group.categories.map((cat) => {
              const k = cat.key as PatientUploadCategoryKey;
              return (
              <OptionalCategoryCard
                key={cat.key}
                skin={skin}
                categoryKey={k}
                title={cat.label}
                description={cat.description}
                tips={cat.tips}
                accept={cat.accept}
                maxFiles={cat.maxFiles}
                minFiles={cat.minFiles}
                existing={uploadsByCategory[cat.key] ?? []}
                busy={!!busyCats[cat.key]}
                locked={locked}
                onUpload={(files) => onUpload(k, files)}
                onDeleted={onDeleted}
              />
            );
            })}
          </div>
        </details>
      ))}
    </section>
  );
}

function OptionalCategoryCard({
  skin,
  categoryKey,
  title,
  description,
  tips,
  accept,
  maxFiles,
  minFiles,
  existing,
  busy,
  locked,
  onUpload,
  onDeleted,
}: {
  skin: Skin;
  categoryKey: PatientUploadCategoryKey;
  title: string;
  description: string;
  tips: readonly string[];
  accept: string;
  maxFiles: number;
  minFiles: number;
  existing: UploadRow[];
  busy: boolean;
  locked: boolean;
  onUpload: (files: File[]) => void;
  onDeleted: (id: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  const border = skin === "audit" ? "border-slate-100" : "border-gray-100";
  const muted = skin === "audit" ? "text-slate-600" : "text-gray-600";

  return (
    <section className={`rounded-lg border ${border} bg-white/60 p-3 space-y-2 ${locked ? "opacity-60" : ""}`}>
      <h3 className={`text-sm font-semibold ${skin === "audit" ? "text-slate-800" : "text-gray-900"}`}>
        {title}{" "}
        <span className={`text-xs font-normal ${muted}`}>(optional)</span>
      </h3>
      <p className={`text-xs ${muted}`}>{description}</p>
      <ul className={`list-disc pl-4 text-xs ${muted}`}>
        {tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className={`text-xs ${muted}`}>
        {existing.length} uploaded
        {minFiles > 0 ? ` • min ${minFiles}` : null} • up to {maxFiles} files
      </p>
      <div
        className={`border border-dashed rounded-lg p-3 text-xs ${
          drag ? (skin === "audit" ? "border-slate-500 bg-slate-50" : "border-gray-700 bg-gray-50") : border
        }`}
        onDragOver={(e) => {
          if (locked) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (locked) return;
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => acceptsImage(f, accept));
          const room = maxFiles - existing.length;
          onUpload(files.slice(0, Math.max(0, room)));
        }}
      >
        <div className="flex justify-between items-center gap-2">
          <label
            htmlFor={`ext-patient-photo-${categoryKey}`}
            className={`px-2 py-1.5 rounded-md text-xs font-medium ${
              locked || busy
                ? "bg-gray-200 text-gray-500"
                : skin === "audit"
                  ? "bg-slate-700 text-white hover:bg-slate-600 cursor-pointer"
                  : "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
            }`}
          >
            {locked ? "Locked" : busy ? "Uploading…" : "Choose files"}
            <input
              id={`ext-patient-photo-${categoryKey}`}
              type="file"
              className="hidden"
              accept={accept}
              multiple
              disabled={locked || busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).filter((f) => acceptsImage(f, accept));
                const room = maxFiles - existing.length;
                onUpload(files.slice(0, Math.max(0, room)));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      {existing.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existing.slice(0, 6).map((u) => (
            <UploadedThumb key={u.id} upload={u} locked={locked} onDeleted={() => onDeleted(u.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
