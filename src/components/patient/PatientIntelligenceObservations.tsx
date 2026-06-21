import type { PatientIntelligenceTranslation } from "@/lib/hairaudit-intelligence/patient/patientIntelligenceTranslation";

export type PatientIntelligenceObservationsProps = {
  translation: PatientIntelligenceTranslation;
};

/**
 * HA-INTELLIGENCE-7 — "What we observed from your images".
 *
 * Patient-safe surface for clinical intelligence. Renders ONLY translated,
 * calm observations produced by the patient translation layer. No scores,
 * no confidence, no engine fields, no technical terminology.
 */
export default function PatientIntelligenceObservations({
  translation,
}: PatientIntelligenceObservationsProps) {
  if (!translation.hasObservations) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        {translation.heading}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{translation.intro}</p>

      <ul className="mt-4 space-y-3">
        {translation.observations.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4"
          >
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {item.areaLabel}
            </span>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">{item.observation}</p>
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        {translation.disclaimer}
      </p>
    </section>
  );
}
