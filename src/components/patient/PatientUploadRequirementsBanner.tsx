"use client";

import { PATIENT_REQUIRED_VIEWS_COPY } from "@/lib/uploads/patientUploadClient";

export default function PatientUploadRequirementsBanner() {
  return (
    <section
      className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4"
      aria-label="Photo requirements"
    >
      <h2 className="text-sm font-semibold text-slate-900">{PATIENT_REQUIRED_VIEWS_COPY.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{PATIENT_REQUIRED_VIEWS_COPY.body}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {PATIENT_REQUIRED_VIEWS_COPY.slots.map((slot) => (
          <div
            key={slot.label}
            className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">{slot.label}</p>
            <p className="mt-0.5 text-xs text-slate-600">{slot.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Accepted formats: JPEG, PNG, WebP. Max 50 MB per image (large phone photos are compressed automatically).
      </p>
    </section>
  );
}
