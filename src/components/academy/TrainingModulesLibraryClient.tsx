"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainingModuleDefinition } from "@/lib/academy/trainingModulesCatalog";

const LS_READ = "academy:training-modules:read-ids";
const LS_OPENED = "academy:training-modules:last-opened";

type Props = {
  modules: TrainingModuleDefinition[];
  storageUserId: string;
  traineeWeek: number | null;
  highlightLadderKeys: string[];
  competencyHref: string | null;
  isStaff: boolean;
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

function saveReadSet(userId: string, ids: Set<string>) {
  localStorage.setItem(`${LS_READ}:${userId}`, JSON.stringify([...ids]));
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

function saveLastOpened(userId: string, map: Record<string, string>) {
  localStorage.setItem(`${LS_OPENED}:${userId}`, JSON.stringify(map));
}

export default function TrainingModulesLibraryClient({
  modules,
  storageUserId,
  traineeWeek,
  highlightLadderKeys,
  competencyHref,
  isStaff,
}: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [lastOpened, setLastOpened] = useState<Record<string, string>>({});

  useEffect(() => {
    setReadIds(loadReadSet(storageUserId));
    setLastOpened(loadLastOpened(storageUserId));
  }, [storageUserId]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [weekFilter, setWeekFilter] = useState<string>("");

  const categories = useMemo(() => {
    const s = new Set(modules.map((m) => m.category));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [modules]);

  const markRead = useCallback(
    (id: string, read: boolean) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        if (read) next.add(id);
        else next.delete(id);
        saveReadSet(storageUserId, next);
        return next;
      });
    },
    [storageUserId]
  );

  const touchOpened = useCallback(
    (id: string) => {
      const iso = new Date().toISOString();
      setLastOpened((prev) => {
        const next = { ...prev, [id]: iso };
        saveLastOpened(storageUserId, next);
        return next;
      });
    },
    [storageUserId]
  );

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (weekFilter) {
        const w = parseInt(weekFilter, 10);
        if (!m.recommendedForWeeks?.includes(w)) return false;
      }
      return true;
    });
  }, [modules, categoryFilter, weekFilter]);

  const highlightSet = useMemo(() => new Set(highlightLadderKeys), [highlightLadderKeys]);

  return (
    <div className="space-y-6">
      {isStaff ? (
        <p className="rounded-lg border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm text-amber-950 shadow-sm">
          Staff view: you see the same catalog as trainees. Assignments in <code className="text-xs">modules.json</code> still apply
          filtering for trainees only.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600">Topic</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All topics</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Week</label>
          <select
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any week</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
              <option key={w} value={String(w)}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
        {(categoryFilter || weekFilter) && (
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("");
              setWeekFilter("");
            }}
            className="text-sm font-medium text-amber-800 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {competencyHref && traineeWeek != null ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm text-slate-700">
          Your program week (for badges): <span className="font-semibold text-slate-800">Week {traineeWeek}</span>.{" "}
          <Link href={competencyHref} className="font-medium text-amber-800 hover:underline">
            Competency dashboard
          </Link>{" "}
          is separate from these materials.
        </p>
      ) : competencyHref ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm text-slate-700">
          <Link href={competencyHref} className="font-medium text-amber-800 hover:underline">
            Open competency dashboard
          </Link>{" "}
          — sign-offs are not tied to this library.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-600">
          No modules match your filters. Add approved entries to <code className="text-xs">public/training/doctors/modules.json</code>{" "}
          and place files under <code className="text-xs">public/training/doctors/</code>.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((m) => {
            const weekBadge =
              traineeWeek != null && m.recommendedForWeeks?.includes(traineeWeek) ? `Week ${traineeWeek}` : null;
            const ladderOverlap =
              m.flags?.relatedCompetencyLadderKeys?.filter((k) => highlightSet.has(k)) ?? [];
            const suggested =
              ladderOverlap.length > 0 || Boolean(weekBadge && (m.flags?.recommended || m.flags?.mandatory));
            const isRead = readIds.has(m.id);
            const opened = lastOpened[m.id];

            return (
              <li
                key={m.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  m.flags?.mandatory
                    ? "border-rose-200 bg-gradient-to-br from-rose-50/40 to-white"
                    : suggested
                      ? "border-amber-200 bg-gradient-to-br from-amber-50/40 to-white ring-1 ring-amber-100"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{m.title}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        {m.category}
                      </span>
                      {m.flags?.mandatory ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-900">
                          Mandatory
                        </span>
                      ) : null}
                      {m.flags?.recommended ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                          Recommended
                        </span>
                      ) : null}
                      {weekBadge ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
                          For {weekBadge}
                        </span>
                      ) : null}
                      {m.recommendedForWeeks?.length && !weekBadge ? (
                        <span className="text-[10px] font-medium text-slate-500">
                          Weeks {m.recommendedForWeeks.join(", ")}
                        </span>
                      ) : null}
                      {suggested && ladderOverlap.length ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900">
                          Related to your milestones
                        </span>
                      ) : null}
                      {isRead ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                          Read
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{m.shortDescription}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{m.category}</span>
                      <span>Updated {m.lastUpdated}</span>
                      {opened ? <span>Last opened {new Date(opened).toLocaleString()}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-2 sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      {m.readOnlineUrl ? (
                        <a
                          href={m.readOnlineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => touchOpened(m.id)}
                          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Read online
                        </a>
                      ) : null}
                      {m.downloadUrl ? (
                        <a
                          href={m.downloadUrl}
                          download
                          onClick={() => touchOpened(m.id)}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={isRead}
                        onChange={(e) => markRead(m.id, e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Mark as read
                    </label>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
