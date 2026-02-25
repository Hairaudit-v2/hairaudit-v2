"use client";

import {
  buildCountsByKey,
  DOCTOR_PHOTO_SCHEMA,
  PATIENT_PHOTO_SCHEMA,
} from "@/lib/auditPhotoSchemas";

type CaseWithEvidence = {
  evidence_score_patient?: string | null;
  confidence_label_patient?: string | null;
  evidence_score_doctor?: string | null;
  confidence_label_doctor?: string | null;
  evidence_details?: Record<string, unknown> | null;
};

type UploadRow = { type: string };

export default function EvidenceSummary({
  caseRow,
  uploads,
  className = "",
}: {
  caseRow: CaseWithEvidence | null;
  uploads: UploadRow[];
  className?: string;
}) {
  if (!caseRow) return null;

  const patientScore = caseRow.evidence_score_patient;
  const patientConfidence = caseRow.confidence_label_patient;
  const doctorScore = caseRow.evidence_score_doctor;
  const doctorConfidence = caseRow.confidence_label_doctor;
  const hasPatient = patientScore != null || uploads.some((u) => u.type?.startsWith("patient_photo:"));
  const hasDoctor = doctorScore != null || uploads.some((u) => u.type?.startsWith("doctor_photo:"));

  if (!hasPatient && !hasDoctor) return null;

  const patientPhotos = uploads.filter((u) => u.type?.startsWith("patient_photo:"));
  const doctorPhotos = uploads.filter((u) => u.type?.startsWith("doctor_photo:"));

  const patientCounts = buildCountsByKey(patientPhotos.map((p) => ({ type: p.type })), "patient");
  const doctorCounts = buildCountsByKey(doctorPhotos.map((p) => ({ type: p.type })), "doctor");

  const scoreClass = (s: string) =>
    s === "A"
      ? "bg-green-100 text-green-800"
      : s === "B"
        ? "bg-blue-100 text-blue-800"
        : s === "C"
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-800";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <h3 className="font-semibold text-slate-900 mb-4">Photo Evidence Summary</h3>

      <div className="space-y-4">
        {hasPatient && (
          <section>
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-sm font-medium text-slate-700">Patient photos</h4>
              {patientScore && (
                <>
                  <span className={`rounded px-2 py-0.5 text-sm font-bold ${scoreClass(patientScore)}`}>
                    {patientScore}
                  </span>
                  <span className="text-xs text-slate-500">{patientConfidence ?? ""}</span>
                </>
              )}
            </div>
            <div className="grid gap-1 text-sm">
              {PATIENT_PHOTO_SCHEMA.map((def) => {
                const n = patientCounts[def.key] ?? 0;
                const ok = n >= def.min;
                return (
                  <div key={def.key} className="flex justify-between">
                    <span className="text-slate-600">{def.title}</span>
                    <span className={ok ? "text-green-600" : "text-amber-600"}>
                      {n} {ok ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasDoctor && (
          <section className={hasPatient ? "pt-4 border-t border-slate-100" : ""}>
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-sm font-medium text-slate-700">Doctor photos</h4>
              {doctorScore && (
                <>
                  <span className={`rounded px-2 py-0.5 text-sm font-bold ${scoreClass(doctorScore)}`}>
                    {doctorScore}
                  </span>
                  <span className="text-xs text-slate-500">{doctorConfidence ?? ""}</span>
                </>
              )}
            </div>
            <div className="grid gap-1 text-sm">
              {DOCTOR_PHOTO_SCHEMA.map((def) => {
                const n = doctorCounts[def.key] ?? 0;
                const ok = n >= def.min;
                return (
                  <div key={def.key} className="flex justify-between">
                    <span className="text-slate-600">{def.title}</span>
                    <span className={ok ? "text-green-600" : "text-amber-600"}>
                      {n} {ok ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
