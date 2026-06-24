"use client";

import { useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Collapsed by default; defers mounting heavy log/diagnostic children until expanded.
 */
export default function AuditorTechnicalLogsSection({ children }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-300">CASE HISTORY / TECHNICAL LOGS</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Processing history, diagnostics, and system metadata — expand when needed.
          </p>
        </div>
        <span className="text-xs font-medium text-slate-400">{expanded ? "Collapse" : "Expand"}</span>
      </button>
      {expanded ? <div className="space-y-4 border-t border-slate-800 px-5 py-4">{children}</div> : null}
    </section>
  );
}
