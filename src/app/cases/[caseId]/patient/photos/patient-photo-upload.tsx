"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  PATIENT_PHOTO_CATEGORIES,
  PatientPhotoCategory,
} from "@/lib/photoCategories";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import ExtendedPatientPhotoUploadGroups from "@/components/patient/ExtendedPatientPhotoUploadGroups";
import PatientImageEvidenceNudgeCallout from "@/components/patient/PatientImageEvidenceNudgeCallout";
import { computePatientImageEvidenceQualityFromCaseUploads } from "@/lib/audit/patientImageEvidenceConfidence";
import { buildPatientImageEvidenceUploadNudges } from "@/lib/audit/patientImageEvidenceUploadNudges";
import { isPatientImageEvidenceNudgesEnabled } from "@/lib/features/enablePatientImageEvidenceNudges";
import type { PatientPhotoUploadGuidancePanel } from "@/lib/patientPhoto/patientPhotoUploadGuidance";

/** Visual grouping only — same keys and submit rules as flat `PATIENT_PHOTO_CATEGORIES`. */
const PATIENT_PHOTO_SECTIONS: {
  heading: string;
  sub: string;
  keys: readonly PatientPhotoCategory[];
}[] = [
  {
    heading: "Before Surgery — Main angles (Required)",
    sub: "Photos taken before your transplant: front, top, and back of head. Use the same three angles you will repeat over time (for example after surgery).",
    keys: ["preop_front", "preop_top", "preop_donor_rear"],
  },
  {
    heading: "Before Surgery Photos (Optional)",
    sub: "These are photos taken before your hair transplant (left, right, and crown). They are still required for the Basic Audit checklist.",
    keys: ["preop_left", "preop_right", "preop_crown"],
  },
  {
    heading: "After Surgery / Progress Photos (Optional)",
    sub: "Surgery-day slots are required where marked; other items in this section are optional add-ons (during procedure, first few days). Later-month photos are in the optional sections below.",
    keys: ["day0_recipient", "day0_donor", "intraop", "postop_day0"],
  },
];

/* ---------------- Types ---------------- */

type UploadRow = {
  id: string;
  type: string; // "patient_photo:preop_front"
  storage_path: string;
  metadata: any;
  created_at: string;
};

/* ---------------- Helpers ---------------- */

function categoryFromType(type: string): PatientPhotoCategory | null {
  const prefix = "patient_photo:";
  if (!type?.startsWith(prefix)) return null;
  return type.slice(prefix.length) as PatientPhotoCategory;
}

/* ---------------- Main ---------------- */

export default function PatientPhotoUpload({
  caseId,
  initialUploads,
  caseStatus,
  submittedAt,
  patientPhotoStageGuidance,
}: {
  caseId: string;
  initialUploads: UploadRow[];
  caseStatus: string;
  submittedAt?: string | null;
  patientPhotoStageGuidance?: PatientPhotoUploadGuidancePanel | null;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [busyCats, setBusyCats] = useState<Record<string, boolean>>({});

  const isLocked = caseStatus === "submitted" || !!submittedAt;

  const uploadsByCategory = useMemo(() => {
    const map: Record<string, UploadRow[]> = {};
    for (const u of uploads) {
      const cat = categoryFromType(u.type);
      if (!cat) continue;
      (map[cat] ||= []).push(u);
    }
    return map;
  }, [uploads]);

  const requiredOk = useMemo(() => {
    return PATIENT_PHOTO_CATEGORIES
      .filter((c) => c.required)
      .every((c) => (uploadsByCategory[c.key]?.length ?? 0) > 0);
  }, [uploadsByCategory]);

  const evidenceNudges = useMemo(() => {
    if (!isPatientImageEvidenceNudgesEnabled()) return [];
    const q = computePatientImageEvidenceQualityFromCaseUploads(
      uploads.map((u) => ({ id: u.id, type: u.type, storage_path: u.storage_path }))
    );
    return buildPatientImageEvidenceUploadNudges(q);
  }, [uploads]);

  const categoryByKey = useMemo(() => {
    const m = new Map<PatientPhotoCategory, (typeof PATIENT_PHOTO_CATEGORIES)[number]>();
    for (const c of PATIENT_PHOTO_CATEGORIES) m.set(c.key, c);
    return m;
  }, []);

  async function uploadFiles(category: PatientPhotoCategory, files: File[]) {
    if (isLocked || !files.length) return;

    setBusyCats((p) => ({ ...p, [category]: true }));
    try {
      const fd = new FormData();
      fd.append("caseId", caseId);
      fd.append("category", category);
      files.forEach((f) => fd.append("files[]", f));

      const res = await fetch("/api/uploads/patient-photos", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");

      if (json.saved?.length) {
        setUploads((prev) => [...json.saved, ...prev]);
      }
    } catch (e: any) {
      alert(e?.message ?? "Upload failed");
    } finally {
      setBusyCats((p) => ({ ...p, [category]: false }));
    }
  }

  async function deleteUpload(uploadId: string) {
    if (isLocked) return;
    if (!confirm("Delete this photo?")) return;

    try {
      const res = await fetch(
        `/api/uploads/delete?uploadId=${encodeURIComponent(uploadId)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } catch (e: any) {
      alert(e?.message ?? "Could not delete photo");
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Upload Patient Photos</h1>
        <p className="text-sm text-gray-800">
          Use the sections below: two <strong>Before Surgery</strong> groups (main angles, then left, right, and crown), then{" "}
          <strong>After Surgery / Progress</strong> (surgery day and early healing).
        </p>
        <p className="text-sm text-gray-600">Use bright indoor light. Hold the phone steady. No filters.</p>

        {isLocked && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <b>Case submitted.</b> Photos are locked to preserve audit integrity.
          </div>
        )}
      </header>

      {evidenceNudges.length > 0 ? <PatientImageEvidenceNudgeCallout nudges={evidenceNudges} /> : null}

      {patientPhotoStageGuidance ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50/90 p-4 text-sm text-gray-900"
          role="note"
        >
          <p className="font-semibold">{patientPhotoStageGuidance.title}</p>
          <p className="mt-1 leading-relaxed text-gray-700">{patientPhotoStageGuidance.body}</p>
        </div>
      ) : null}

      <div className="space-y-8">
        {PATIENT_PHOTO_SECTIONS.map((section, sIdx) => (
          <div
            key={section.heading}
            className={`space-y-4 ${sIdx > 0 ? "pt-6 border-t border-gray-200" : ""}`}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">{section.heading}</h2>
              <p className="text-sm text-gray-600">{section.sub}</p>
            </div>
            <div className="space-y-4">
              {section.keys.map((key) => {
                const cat = categoryByKey.get(key);
                if (!cat) return null;
                return (
                  <PhotoCategoryCard
                    key={cat.key}
                    category={cat.key}
                    title={cat.title}
                    required={cat.required}
                    help={cat.help}
                    tips={cat.tips}
                    existing={uploadsByCategory[cat.key] ?? []}
                    maxFiles={cat.maxFiles}
                    accept={cat.accept}
                    busy={!!busyCats[cat.key]}
                    locked={isLocked}
                    onUpload={(files) => uploadFiles(cat.key, files)}
                    onDeleted={deleteUpload}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <ExtendedPatientPhotoUploadGroups
        locked={isLocked}
        busyCats={busyCats}
        uploadsByCategory={uploadsByCategory}
        onUpload={uploadFiles}
        onDeleted={deleteUpload}
        skin="legacy"
        extendedGroupOrderHint={patientPhotoStageGuidance?.extendedGroupOrderHint}
      />

      <footer className="flex items-center justify-between pt-3 border-t text-sm">
        <span>
          {isLocked
            ? "Case submitted — photos locked"
            : requiredOk
            ? "Required photos complete ✅"
            : "Upload required categories to continue"}
        </span>

        <div className="flex items-center gap-3">
          <Link
            href={`/cases/${caseId}/patient/questions`}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to questions
          </Link>
          <Link
            href={`/cases/${caseId}`}
            className={`rounded-md px-4 py-2 font-medium ${
              requiredOk && !isLocked
                ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                : "bg-gray-200 text-gray-500 pointer-events-none"
            }`}
          >
            3. Submit for audit
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- Category Card ---------------- */

function PhotoCategoryCard(props: {
  category: string;
  title: string;
  required: boolean;
  help: string;
  tips: readonly string[];
  existing: UploadRow[];
  maxFiles: number;
  accept: string;
  busy: boolean;
  locked: boolean;
  onUpload: (files: File[]) => void;
  onDeleted: (uploadId: string) => void;
}) {
  const [drag, setDrag] = useState(false);

  return (
    <section className={`rounded-xl border p-4 space-y-3 ${props.locked ? "opacity-60" : ""}`}>
      <h2 className="font-semibold">
        {props.title}
        {props.required ? (
          <span className="ml-2 text-xs font-normal text-amber-800">(Required)</span>
        ) : (
          <span className="ml-2 text-xs font-normal text-gray-500">(Optional)</span>
        )}
      </h2>

      <p className="text-sm text-gray-600">{props.help}</p>

      <ul className="list-disc pl-5 text-sm text-gray-600">
        {props.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-sm ${
          drag ? "border-black bg-gray-50" : "border-gray-300"
        }`}
        onDragOver={(e) => {
          if (props.locked) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (props.locked) return;
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/")
          );
          props.onUpload(files.slice(0, props.maxFiles));
        }}
      >
        <div className="flex justify-between items-center">
          <span>{props.existing.length} uploaded</span>

          <label
            htmlFor={`patient-photo-upload-${props.category}`}
            className={`px-3 py-2 rounded-md ${
              props.locked || props.busy
                ? "bg-gray-200 text-gray-500"
                : "bg-black text-white cursor-pointer"
            }`}
          >
            {props.locked ? "Locked" : props.busy ? "Uploading…" : "Choose files"}
            <input
              id={`patient-photo-upload-${props.category}`}
              name="patientPhotos"
              type="file"
              className="hidden"
              accept={props.accept}
              multiple
              disabled={props.locked || props.busy}
              onChange={(e) =>
                props.onUpload(Array.from(e.target.files ?? []))
              }
            />
          </label>
        </div>
      </div>

      {props.existing.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {props.existing.slice(0, 6).map((u) => (
            <UploadedThumb
              key={u.id}
              upload={u}
              locked={props.locked}
              onDeleted={() => props.onDeleted(u.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
