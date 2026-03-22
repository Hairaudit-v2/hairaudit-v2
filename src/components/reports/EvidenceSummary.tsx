"use client";

import {
  buildCountsByKey,
  DOCTOR_PHOTO_SCHEMA,
  PATIENT_PHOTO_SCHEMA,
} from "@/lib/auditPhotoSchemas";
import { isPatientUploadAuditExcluded } from "@/lib/uploads/patientPhotoAuditMeta";

type CaseWithEvidence = {
  evidence_score_patient?: string | null;
  confidence_label_patient?: string | null;
  evidence_score_doctor?: string | null;
  confidence_label_doctor?: string | null;
  evidence_details?: Record<string, unknown> | null;
};

type UploadRow = { type: string; metadata?: unknown };

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

  const patientPhotos = uploads.filter(
    (u) => u.type?.startsWith("patient_photo:") && !isPatientUploadAuditExcluded(u)
  );
  const doctorPhotos = uploads.filter((u) => u.type?.startsWith("doctor_photo:"));

  const patientCounts = buildCountsByKey(patientPhotos.map((p) => ({ type: p.type })), "patient");
  const doctorCounts = buildCountsByKey(doctorPhotos.map((p) => ({ type: p.type })), "doctor");

  const scoreClass = (s: string) =>
    s === "A"
      ? "bg-emerald-300/20 text-emerald-100"
      : s === "B"
        ? "bg-cyan-300/20 text-cyan-100"
        : s === "C"
          ? "bg-amber-300/20 text-amber-100"
          : "bg-rose-300/20 text-rose-100";

  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-900 p-6 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-white">Photo Evidence Summary</h3>

      <div className="space-y-4">
        {hasPatient && (
          <section>
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-sm font-medium text-slate-200">Patient photos</h4>
              {patientScore && (
                <>
                  <span className={`rounded px-2 py-0.5 text-sm font-bold ${scoreClass(patientScore)}`}>
                    {patientScore}
                  </span>
                  <span className="text-xs text-slate-200">{patientConfidence ?? ""}</span>
                </>
              )}
            </div>
            <div className="grid gap-1 text-sm">
              {PATIENT_PHOTO_SCHEMA.map((def) => {
                const n = patientCounts[def.key] ?? 0;
                const ok = n >= def.min;
                return (
                  <div key={def.key} className="flex justify-between">
                    <span className="text-slate-100">{def.title}</span>
                    <span className={ok ? "text-emerald-300" : "text-amber-300"}>
                      {n} {ok ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasDoctor && (
          <section className={hasPatient ? "pt-4 border-t border-slate-700" : ""}>
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-sm font-medium text-slate-200">Doctor photos</h4>
              {doctorScore && (
                <>
                  <span className={`rounded px-2 py-0.5 text-sm font-bold ${scoreClass(doctorScore)}`}>
                    {doctorScore}
                  </span>
                  <span className="text-xs text-slate-200">{doctorConfidence ?? ""}</span>
                </>
              )}
            </div>
            <div className="grid gap-1 text-sm">
              {DOCTOR_PHOTO_SCHEMA.map((def) => {
                const n = doctorCounts[def.key] ?? 0;
                const ok = n >= def.min;
                return (
                  <div key={def.key} className="flex justify-between">
                    <span className="text-slate-100">{def.title}</span>
                    <span className={ok ? "text-emerald-300" : "text-amber-300"}>
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
