import type { LegacyVsNormalizedComparison } from "@/lib/auditos/review/compareLegacyAndNormalizedReport";
import type { EvidenceCompletenessViewModel } from "@/lib/auditos/review/buildEvidenceCompletenessViewModel";
import type { DomainNormalizationViewModel } from "@/lib/auditos/review/buildDomainNormalizationViewModel";

export type AuditOsReviewSnapshotMeta = {
  id: string;
  snapshotKind: string;
  reportVersion: number | null;
  createdAt: string;
  structuralDiffStatus: string | null;
  warningsCount: number;
  sourceEventName: string | null;
};

export type AuditOsReviewPanelProps = {
  snapshotMeta: AuditOsReviewSnapshotMeta | null;
  comparison: LegacyVsNormalizedComparison;
  evidence: EvidenceCompletenessViewModel;
  domains: DomainNormalizationViewModel;
  adapterVersions: Record<string, unknown>;
  /** Row-level warnings from persistence (structural / adapter), not patient narrative. */
  snapshotWarnings: string[];
};

function statusPill(status: string): string {
  if (status === "ok" || status === "complete") return "border-emerald-500/40 bg-emerald-950/50 text-emerald-100";
  if (status === "warning" || status === "partial") return "border-amber-500/40 bg-amber-950/40 text-amber-100";
  if (status === "missing" || status === "limited" || status === "unknown")
    return "border-slate-500/40 bg-slate-900/60 text-slate-200";
  return "border-sky-500/30 bg-sky-950/40 text-sky-100";
}

/**
 * Stage 4D — read-only, auditor-only structural review over persisted AuditOS shadow JSON.
 * Does not replace legacy `reports.summary` authority.
 */
export default function AuditOsReviewPanel(props: AuditOsReviewPanelProps) {
  const { snapshotMeta, comparison, evidence, domains, adapterVersions, snapshotWarnings } = props;

  const mergedWarnings = [...snapshotWarnings, ...comparison.warnings].filter(Boolean);
  const uniqueWarnings = [...new Set(mergedWarnings)];

  return (
    <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">AuditOS review (internal)</p>
      <p className="mt-1 text-xs text-cyan-100/85">
        Structural completeness only — not clinical judgement. Patient-facing report output and legacy scoring authority are
        unchanged; this panel compares persisted AuditOS shadow JSON to the legacy summary shape.
      </p>
      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-50/95">
        <strong className="text-amber-100">Legacy report remains authoritative.</strong> Use this view for alignment QA only.
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill(comparison.status)}`}>
          comparison: {comparison.status}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill(evidence.completenessStatus)}`}>
          evidence: {evidence.completenessStatus}
        </span>
        {snapshotMeta ? (
          <span className="rounded-full border border-cyan-400/25 bg-black/30 px-2 py-0.5 text-[11px] text-cyan-50/90">
            snapshot {snapshotMeta.snapshotKind} · v{snapshotMeta.reportVersion ?? "—"} · diff{" "}
            {snapshotMeta.structuralDiffStatus ?? "—"}
          </span>
        ) : (
          <span className="rounded-full border border-slate-600/50 bg-slate-900/50 px-2 py-0.5 text-[11px] text-slate-300">
            no persisted snapshot row
          </span>
        )}
      </div>

      {snapshotMeta ? (
        <dl className="mt-3 grid gap-1 text-[11px] text-cyan-50/90 sm:grid-cols-2">
          <div>
            <dt className="text-cyan-300/70">Snapshot id</dt>
            <dd className="font-mono text-cyan-100/95">{snapshotMeta.id}</dd>
          </div>
          <div>
            <dt className="text-cyan-300/70">Created (UTC)</dt>
            <dd>{snapshotMeta.createdAt ? snapshotMeta.createdAt.slice(0, 19) + "Z" : "—"}</dd>
          </div>
          <div>
            <dt className="text-cyan-300/70">Source event</dt>
            <dd className="break-all">{snapshotMeta.sourceEventName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-cyan-300/70">Row warnings count</dt>
            <dd>{snapshotMeta.warningsCount}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-3 rounded-lg border border-cyan-500/15 bg-black/25 px-3 py-2">
        <p className="text-xs font-medium text-cyan-100">Structural comparison metrics</p>
        <ul className="mt-1.5 grid gap-1 text-[11px] text-cyan-50/90 sm:grid-cols-2">
          <li>legacy overall score present: {String(comparison.metrics.legacyOverallScorePresent)}</li>
          <li>normalized overall score present: {String(comparison.metrics.normalizedOverallScorePresent)}</li>
          <li>legacy domain rows: {comparison.metrics.legacyDomainCount}</li>
          <li>normalized domain rows: {comparison.metrics.normalizedDomainCount}</li>
          <li>evidence items (manifest): {comparison.metrics.evidenceItemCount}</li>
          <li>missing evidence entries: {comparison.metrics.missingEvidenceCount}</li>
          <li>finding sections (max of legacy vs normalized): {comparison.metrics.findingSectionCount}</li>
          <li>recommendations (max): {comparison.metrics.recommendationCount}</li>
          <li>limitations present: {String(comparison.metrics.limitationsPresent)}</li>
        </ul>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-cyan-500/15 bg-black/20 px-3 py-2">
          <p className="text-xs font-medium text-cyan-100">Evidence completeness (grouped)</p>
          {evidence.groups.length ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[11px] text-cyan-50/90">
              {evidence.groups.slice(0, 40).map((g) => (
                <li key={g.groupKey} className="flex justify-between gap-2 border-b border-cyan-500/10 pb-1 last:border-0">
                  <span className="min-w-0 truncate" title={g.label}>
                    {g.label}
                  </span>
                  <span className="shrink-0 font-mono text-cyan-200/90">{g.itemCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-cyan-200/60">No grouped evidence rows.</p>
          )}
          <p className="mt-2 text-[11px] text-cyan-200/80">Included total: {evidence.includedTotal}</p>
          {evidence.missingEvidence.length ? (
            <div className="mt-2">
              <p className="text-[11px] font-medium text-amber-100/90">Missing evidence labels</p>
              <ul className="mt-1 max-h-28 list-disc space-y-0.5 overflow-auto pl-4 text-[11px] text-amber-50/90">
                {evidence.missingEvidence.slice(0, 30).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {(evidence.qualityHintLines.length > 0 || evidence.confidenceHintLines.length > 0) && (
            <div className="mt-2 text-[10px] text-cyan-200/70">
              {evidence.qualityHintLines.length ? (
                <p className="mt-1">Quality hints: {evidence.qualityHintLines.slice(0, 5).join(" · ")}</p>
              ) : null}
              {evidence.confidenceHintLines.length ? (
                <p className="mt-1">Confidence hints: {evidence.confidenceHintLines.slice(0, 5).join(" · ")}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-cyan-500/15 bg-black/20 px-3 py-2">
          <p className="text-xs font-medium text-cyan-100">Domain normalization</p>
          {domains.domains.length ? (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-auto text-[11px] text-cyan-50/90">
              {domains.domains.map((d) => (
                <li key={d.domainId} className="border-b border-cyan-500/10 pb-1.5 last:border-0">
                  <span className="font-mono text-cyan-200">{d.domainId}</span>
                  {d.hasHumanOverrideOnDomain ? (
                    <span className="ml-2 rounded bg-violet-600/40 px-1 text-[10px] text-violet-50">override</span>
                  ) : null}
                  <div className="mt-0.5 text-[10px] text-cyan-200/75">
                    raw {d.rawScore ?? "—"} · weighted {d.weightedScore ?? "—"} · conf {d.confidence ?? "—"}
                    {d.evidenceGrade ? ` · grade ${d.evidenceGrade}` : ""}
                  </div>
                  {d.legacyMetadataKeys.length ? (
                    <div className="mt-0.5 text-[10px] text-cyan-300/60">legacy meta keys: {d.legacyMetadataKeys.join(", ")}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-cyan-200/60">No domain scores in normalized snapshot.</p>
          )}
          <p className="mt-2 text-[11px] text-cyan-100/85">
            Overall: {domains.overallScore ?? "—"} · grade {domains.grade ?? "—"} · {domains.confidenceLabel ?? "—"} · human
            overrides: {String(domains.humanOverridesActive)}
          </p>
        </div>
      </div>

      {(uniqueWarnings.length > 0 || domains.warnings.length > 0) && (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2">
          <p className="text-xs font-medium text-amber-100">Warnings</p>
          <ul className="mt-1 max-h-36 list-disc space-y-0.5 overflow-auto pl-4 text-[11px] text-amber-50/95">
            {[...new Set([...domains.warnings, ...uniqueWarnings])].slice(0, 40).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-cyan-100">Adapter versions (snapshot)</summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-cyan-50/95">
          {JSON.stringify(adapterVersions, null, 2)}
        </pre>
      </details>
    </div>
  );
}
