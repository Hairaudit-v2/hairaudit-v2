"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LS_READ = "academy:training-modules:read-ids";
const LS_OPENED = "academy:training-modules:last-opened";

export type TraineeModuleHintItem = {
  id: string;
  title: string;
  readOnlineUrl: string | null;
};

type Props = {
  userId: string;
  modules: TraineeModuleHintItem[];
};

function loadReadSet(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${LS_READ}:${userId}`);
    if (!raw) return new Set();
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return new Set();
    return new Set(a.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function loadLastOpened(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${LS_OPENED}:${userId}`);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Hydrates library progress from the same localStorage keys as the training library (read + last opened).
 */
export default function TraineeModuleHintsClient({ userId, modules }: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [lastOpened, setLastOpened] = useState<Record<string, string>>({});

  useEffect(() => {
    setReadIds(loadReadSet(userId));
    setLastOpened(loadLastOpened(userId));
  }, [userId]);

  const byId = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  const readCount = useMemo(() => [...readIds].filter((id) => byId.has(id)).length, [readIds, byId]);

  const continueModule = useMemo(() => {
    let bestId: string | null = null;
    let bestT = 0;
    for (const [id, iso] of Object.entries(lastOpened)) {
      if (!byId.has(id)) continue;
      const t = new Date(iso).getTime();
      if (Number.isFinite(t) && t > bestT) {
        bestT = t;
        bestId = id;
      }
    }
    return bestId ? byId.get(bestId) ?? null : null;
  }, [lastOpened, byId]);

  if (modules.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No modules are visible yet. When your faculty publish assignments, they will appear in the{" "}
        <Link href="/academy/training-modules" className="font-medium text-amber-800 underline hover:no-underline">
          training library
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p>
        <span className="font-semibold text-slate-800">Self-study progress (this device):</span>{" "}
        <span className="tabular-nums text-slate-700">
          {readCount}/{modules.length}
        </span>{" "}
        modules marked read in the library.
      </p>
      {continueModule?.readOnlineUrl ? (
        <p>
          <span className="font-semibold text-slate-800">Continue:</span>{" "}
          <Link
            href={continueModule.readOnlineUrl}
            className="font-medium text-amber-900 underline decoration-amber-900/30 hover:decoration-amber-900"
          >
            {continueModule.title}
          </Link>{" "}
          <span className="text-slate-500">— opens your last viewed resource.</span>
        </p>
      ) : continueModule ? (
        <p className="text-slate-500">
          <span className="font-semibold text-slate-700">Continue:</span> {continueModule.title} (open in the library for a
          read-online link).
        </p>
      ) : (
        <p className="text-slate-500">Open any module in the library to enable “continue where you left off” on this device.</p>
      )}
    </div>
  );
}
