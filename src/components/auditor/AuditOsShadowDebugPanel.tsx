import type { AuditOsShadowDiffResult } from "@/lib/auditos/shadow/diffAuditOsShadowSnapshot";
import type { AuditOsAdapterVersions } from "@/lib/auditos/shadow/buildAuditOsShadowSnapshot.server";
import type { AuditOsShadowSnapshotListItem } from "@/lib/auditos/shadow/loadAuditOsShadowSnapshots.server";

export type AuditOsShadowDebugPanelPayload = {
  adapterVersions: AuditOsAdapterVersions;
  diffStatus: AuditOsShadowDiffResult["status"];
  metrics: AuditOsShadowDiffResult["metrics"];
  warnings: string[];
  /** Persisted rows (Stage 4C) when loader returned data. */
  persistedSnapshots?: AuditOsShadowSnapshotListItem[] | null;
};

/**
 * Auditor-only, gated debug surface (Stage 4B/4C). Renders nothing when `debug` is null.
 */
export default function AuditOsShadowDebugPanel({ debug }: { debug: AuditOsShadowDebugPanelPayload | null }) {
  if (!debug) return null;
  const persisted = debug.persistedSnapshots?.length ? debug.persistedSnapshots : null;
  return (
    <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">AuditOS shadow (internal)</p>
      <p className="mt-1 text-xs text-violet-100/80">
        Structural parity only. Legacy report summary remains authoritative. Persistence is optional and env-gated.
      </p>
      {persisted ? (
        <div className="mt-3 rounded-lg border border-violet-400/20 bg-black/25 px-3 py-2">
          <p className="text-xs font-medium text-violet-100">Persisted snapshots (latest first)</p>
          <ul className="mt-2 space-y-1.5 text-[11px] text-violet-50/90">
            {persisted.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-violet-500/10 pb-1 last:border-0">
                <span className="font-mono text-violet-200/95">{r.snapshotKind}</span>
                <span>v{r.reportVersion ?? "—"}</span>
                <span className="text-violet-300/80">{r.diffStatus ?? "—"}</span>
                <span>{r.warningsCount} warnings</span>
                <span className="text-violet-400/80">
                  {r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19) + "Z" : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-violet-100">Adapter versions and diff metrics (live)</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-violet-50/95">
          {JSON.stringify(
            {
              adapterVersions: debug.adapterVersions,
              diffStatus: debug.diffStatus,
              metrics: debug.metrics,
              warnings: debug.warnings,
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}
