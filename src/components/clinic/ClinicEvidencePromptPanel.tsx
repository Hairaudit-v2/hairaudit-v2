import type { ClinicEvidencePrompt } from "@/lib/audit/clinicEvidencePromptsFromSufficiency";

export default function ClinicEvidencePromptPanel({ prompts }: { prompts: ClinicEvidencePrompt[] }) {
  if (!prompts.length) return null;

  return (
    <section
      className="rounded-2xl border border-emerald-900/35 bg-slate-950/40 p-5"
      aria-label="Clinic evidence coordination notes"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-600/80">
        Patient image evidence — coordination notes
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Informational prompts from the same sufficiency model as internal review. Optional uploads only; does not affect
        scores, eligibility, or submission requirements.
      </p>
      <ul className="mt-4 space-y-3">
        {prompts.map((p) => (
          <li key={p.groupId} className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-400">{p.heading}</p>
            <p className="mt-1 text-sm leading-snug text-slate-300">{p.prompt}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
