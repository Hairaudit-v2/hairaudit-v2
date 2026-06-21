/**
 * Public-only verified case highlights. No internal cases or sensitive data.
 */

export type VerifiedCaseHighlight = {
  /** Case id for non-sensitive display (e.g. short ref) */
  id: string;
  /** Submitted date ISO string if available */
  submittedAt: string | null;
};

function shortCaseRef(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export default function VerifiedCaseHighlights({
  highlights,
}: {
  highlights: VerifiedCaseHighlight[];
}) {
  if (highlights.length === 0) {
    return (
      <section className="relative px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-4">
            Verified Case Highlights
          </h2>
          <div className="rounded-2xl border border-border/50 bg-card/70 p-8 text-center shadow-fi-panel">
            <p className="font-medium text-foreground">
              This clinic is building its verified case library.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Publicly verified cases will appear here as they are released.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-4">
          Verified Case Highlights
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {highlights.map((h) => (
            <div
              key={h.id}
              className="rounded-xl border border-border/50 bg-card/70 p-4 shadow-fi-panel"
            >
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {shortCaseRef(h.id)}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Verified public audit
              </p>
              {h.submittedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(h.submittedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
