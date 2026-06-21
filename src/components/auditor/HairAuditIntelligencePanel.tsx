import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";

export type HairAuditIntelligencePanelProps = {
  bundle: HairAuditIntelligenceBundle;
  reportVersion?: number | null;
};

function severityPill(severity: string): string {
  if (severity === "none" || severity === "minor") return "border-emerald-500/40 bg-emerald-950/50 text-emerald-100";
  if (severity === "moderate") return "border-amber-500/40 bg-amber-950/40 text-amber-100";
  return "border-rose-500/40 bg-rose-950/40 text-rose-100";
}

/**
 * HA-INTELLIGENCE-2 — read-only advisory intelligence for auditor/doctor review.
 * Does not alter patient-facing report authority or layout.
 */
export default function HairAuditIntelligencePanel({ bundle, reportVersion }: HairAuditIntelligencePanelProps) {
  const engines = [
    { label: "Hair loss classification", output: bundle.hairLossClassification },
    { label: "Donor intelligence", output: bundle.donorIntelligence },
    { label: "Repair surgery", output: bundle.repairSurgery },
    { label: "Procedural intelligence", output: bundle.proceduralIntelligence },
  ] as const;

  return (
    <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
        Clinical intelligence (advisory)
      </p>
      <p className="mt-1 text-xs text-violet-100/85">
        Advisory intelligence bundle stored in report metadata only. Patient report wording and layout are
        unchanged; this panel is for professional review.
        {bundle.classifierSource && bundle.classifierSource !== "none"
          ? ` Classifier source: ${bundle.classifierSource}.`
          : ""}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${severityPill(bundle.overallSeverity)}`}>
          overall severity: {bundle.overallSeverity}
        </span>
        <span className="rounded-full border border-violet-400/25 bg-black/30 px-2 py-0.5 text-[11px] text-violet-50/90">
          confidence: {bundle.overallConfidence}
        </span>
        <span className="rounded-full border border-violet-400/25 bg-black/30 px-2 py-0.5 text-[11px] text-violet-50/90">
          {bundle.engineVersion}
          {reportVersion != null ? ` · v${reportVersion}` : ""}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 text-[11px] text-violet-50/90 sm:grid-cols-2">
        <div>
          <dt className="text-violet-300/70">Generated (UTC)</dt>
          <dd>{bundle.generatedAt}</dd>
        </div>
        <div>
          <dt className="text-violet-300/70">Execution mode</dt>
          <dd>{bundle.hairLossClassification.executionMode}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3">
        {engines.map(({ label, output }) => (
          <div key={output.engineId} className="rounded-lg border border-violet-500/20 bg-black/20 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="text-[11px] font-semibold text-violet-100">{label}</p>
              <code className="text-[9px] text-violet-300/60">{output.engineId}</code>
            </div>
            <p className="mt-1 text-[11px] text-violet-50/90">{output.classification}</p>
            <p className="mt-1 text-[10px] text-violet-200/75">
              severity {output.severity} · confidence {output.confidence} · mode {output.executionMode} · advisoryOnly{" "}
              {String(output.advisoryOnly)}
            </p>

            {/* Raw engine fields — professional review only (HA-INTELLIGENCE-7). */}
            <dl className="mt-2 grid gap-x-3 gap-y-0.5 text-[10px] text-violet-100/80 sm:grid-cols-2">
              {Object.entries(output.fields as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="text-violet-300/60">{key}</dt>
                  <dd className="text-right font-mono text-violet-50/85">
                    {Array.isArray(value)
                      ? value.length
                        ? value.join("; ")
                        : "—"
                      : String(value ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-2 text-[10px] text-violet-100/80">
              <span className="text-violet-300/60">clinicianNotes: </span>
              {output.clinicianNotes}
            </p>
            <p className="mt-1 text-[10px] text-violet-100/80">
              <span className="text-violet-300/60">suggestedNextStep: </span>
              {output.suggestedNextStep}
            </p>
          </div>
        ))}
      </div>

      {bundle.imageEvidence && bundle.imageEvidence.length > 0 ? (
        <div className="mt-4 rounded-lg border border-violet-500/15 bg-black/15 px-3 py-2">
          <p className="text-[11px] font-semibold text-violet-100">Classifier image evidence</p>
          <ul className="mt-2 space-y-1 text-[10px] text-violet-50/85">
            {bundle.imageEvidence.map((img) => (
              <li key={img.uploadId ?? img.canonicalPhotoCategory}>
                <span className="font-medium">{img.canonicalPhotoCategory}</span>
                {img.qualityStatus ? ` · quality ${img.qualityStatus}` : ""}
                {img.protocolStatus ? ` · protocol ${img.protocolStatus}` : ""}
                {img.classifierConfidence != null ? ` · confidence ${img.classifierConfidence}` : ""}
                {img.imageLimitations?.length ? (
                  <span className="block text-violet-200/70">
                    {img.imageLimitations.join(" ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
