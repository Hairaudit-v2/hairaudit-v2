"use client";

import { useMemo, useState } from "react";
import {
  deriveTrainingCaseMetrics,
  type TrainingCaseMetricsPrimaryInput,
} from "@/lib/academy/trainingCaseMetricsDerived";

type MetricsInitial = Record<string, string | number | boolean | null | undefined>;

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toTimeInput(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
}

function parseIntField(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatField(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function AutoBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
      Auto
    </span>
  );
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function StatReadout({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
        {label}
        <AutoBadge />
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">{value}</div>
      {sub ? <p className="mt-1 text-[10px] leading-snug text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default function AcademyMetricsForm({
  caseId,
  surgeryDate,
  initial,
}: {
  caseId: string;
  surgeryDate: string;
  initial: MetricsInitial;
}) {
  const [saved, setSaved] = useState<MetricsInitial>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [graftsAttempted, setGraftsAttempted] = useState(() => toStr(initial.grafts_attempted));
  const [graftsExtracted, setGraftsExtracted] = useState(() => toStr(initial.grafts_extracted));
  const [graftsImplanted, setGraftsImplanted] = useState(() => toStr(initial.grafts_implanted));
  const [totalHairs, setTotalHairs] = useState(() => toStr(initial.total_hairs));

  const [extStart, setExtStart] = useState(() => toTimeInput(initial.extraction_start_time));
  const [extEnd, setExtEnd] = useState(() => toTimeInput(initial.extraction_end_time));
  const [impStart, setImpStart] = useState(() => toTimeInput(initial.implantation_start_time));
  const [impEnd, setImpEnd] = useState(() => toTimeInput(initial.implantation_end_time));

  const [punchSize, setPunchSize] = useState(() => toStr(initial.punch_size));
  const [punchType, setPunchType] = useState(() => toStr(initial.punch_type));
  const [implantMethod, setImplantMethod] = useState(() => toStr(initial.implantation_method));
  const [observed, setObserved] = useState(() => Boolean(initial.observed_by_trainer));

  const [transectCount, setTransectCount] = useState(() => toStr(initial.transected_grafts_count));
  const [buriedCount, setBuriedCount] = useState(() => toStr(initial.buried_grafts_count));
  const [poppedCount, setPoppedCount] = useState(() => toStr(initial.popped_grafts_count));

  const [manualTransect, setManualTransect] = useState(() => toStr(initial.transection_rate));
  const [manualBuried, setManualBuried] = useState(() => toStr(initial.buried_graft_rate));
  const [manualPopping, setManualPopping] = useState(() => toStr(initial.popping_rate));

  const primary: TrainingCaseMetricsPrimaryInput = useMemo(
    () => ({
      grafts_attempted: parseIntField(graftsAttempted),
      grafts_extracted: parseIntField(graftsExtracted),
      grafts_implanted: parseIntField(graftsImplanted),
      total_hairs: parseIntField(totalHairs),
      extraction_start_time: extStart.trim() || null,
      extraction_end_time: extEnd.trim() || null,
      implantation_start_time: impStart.trim() || null,
      implantation_end_time: impEnd.trim() || null,
      transected_grafts_count: parseIntField(transectCount),
      buried_grafts_count: parseIntField(buriedCount),
      popped_grafts_count: parseIntField(poppedCount),
    }),
    [
      graftsAttempted,
      graftsExtracted,
      graftsImplanted,
      totalHairs,
      extStart,
      extEnd,
      impStart,
      impEnd,
      transectCount,
      buriedCount,
      poppedCount,
    ]
  );

  const derived = useMemo(
    () =>
      deriveTrainingCaseMetrics(primary, {
        transection_rate: parseFloatField(manualTransect),
        buried_graft_rate: parseFloatField(manualBuried),
        popping_rate: parseFloatField(manualPopping),
      }),
    [primary, manualTransect, manualBuried, manualPopping]
  );

  const numSaved = (k: string) => {
    const v = saved[k];
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const disp = (live: number | null, key: string, format: (n: number) => string) => {
    if (live != null) return format(live);
    const f = numSaved(key);
    return f != null ? format(f) : "—";
  };

  const totalHairsSession = parseIntField(totalHairs);
  const showManualTransect = parseIntField(transectCount) == null;
  const showManualBuried = parseIntField(buriedCount) == null;
  const showManualPopping = parseIntField(poppedCount) == null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const patch: Record<string, string | number | boolean | null> = {
      grafts_attempted: parseIntField(graftsAttempted),
      grafts_extracted: parseIntField(graftsExtracted),
      grafts_implanted: parseIntField(graftsImplanted),
      total_hairs: parseIntField(totalHairs),
      extraction_start_time: extStart.trim() || null,
      extraction_end_time: extEnd.trim() || null,
      implantation_start_time: impStart.trim() || null,
      implantation_end_time: impEnd.trim() || null,
      punch_size: punchSize.trim() || null,
      punch_type: punchType.trim() || null,
      implantation_method: implantMethod.trim() || null,
      observed_by_trainer: observed,
      transected_grafts_count: parseIntField(transectCount),
      buried_grafts_count: parseIntField(buriedCount),
      popped_grafts_count: parseIntField(poppedCount),
    };

    if (showManualTransect) patch.transection_rate = parseFloatField(manualTransect);
    if (showManualBuried) patch.buried_graft_rate = parseFloatField(manualBuried);
    if (showManualPopping) patch.popping_rate = parseFloatField(manualPopping);

    try {
      const res = await fetch(`/api/academy/cases/${caseId}/metrics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; metrics?: MetricsInitial };
      if (!res.ok) throw new Error(j.error || "Save failed");
      if (j.metrics) setSaved(j.metrics);
      setMsg("Metrics saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900">Case metrics</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            Enter core session data once. Durations, throughput, hair ratio, and estimated TOB update live. Clock times refer to{" "}
            <span className="font-medium text-slate-700">{surgeryDate}</span> (local session times).
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save metrics"}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/60 p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/90">Primary inputs</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldShell label="Grafts attempted">
            <input className={inputCls} inputMode="numeric" value={graftsAttempted} onChange={(e) => setGraftsAttempted(e.target.value)} />
          </FieldShell>
          <FieldShell label="Grafts extracted">
            <input className={inputCls} inputMode="numeric" value={graftsExtracted} onChange={(e) => setGraftsExtracted(e.target.value)} />
          </FieldShell>
          <FieldShell label="Grafts implanted">
            <input className={inputCls} inputMode="numeric" value={graftsImplanted} onChange={(e) => setGraftsImplanted(e.target.value)} />
          </FieldShell>
          <FieldShell label="Total hairs (session / day)">
            <input className={inputCls} inputMode="numeric" value={totalHairs} onChange={(e) => setTotalHairs(e.target.value)} />
          </FieldShell>
          <FieldShell label="Extraction start" hint="local time">
            <input className={inputCls} type="time" value={extStart} onChange={(e) => setExtStart(e.target.value)} />
          </FieldShell>
          <FieldShell label="Extraction end" hint="local time">
            <input className={inputCls} type="time" value={extEnd} onChange={(e) => setExtEnd(e.target.value)} />
          </FieldShell>
          <FieldShell label="Implantation start" hint="local time">
            <input className={inputCls} type="time" value={impStart} onChange={(e) => setImpStart(e.target.value)} />
          </FieldShell>
          <FieldShell label="Implantation end" hint="local time">
            <input className={inputCls} type="time" value={impEnd} onChange={(e) => setImpEnd(e.target.value)} />
          </FieldShell>
          <FieldShell label="Punch size">
            <input className={inputCls} value={punchSize} onChange={(e) => setPunchSize(e.target.value)} placeholder='e.g. 0.85 mm' />
          </FieldShell>
          <FieldShell label="Punch type">
            <input className={inputCls} value={punchType} onChange={(e) => setPunchType(e.target.value)} placeholder="e.g. sharp, dull" />
          </FieldShell>
          <FieldShell label="Implantation method">
            <input
              className={inputCls}
              value={implantMethod}
              onChange={(e) => setImplantMethod(e.target.value)}
              placeholder="e.g. premade slit, stick-and-place"
            />
          </FieldShell>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm">
          <input type="checkbox" checked={observed} onChange={(e) => setObserved(e.target.checked)} className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
          <span className="font-medium">Observed by trainer</span>
          <span className="text-xs font-normal text-slate-500">(this session)</span>
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Quality — counts (optional)</p>
        <p className="mt-1 text-xs text-slate-500">
          Raw counts derive % vs session denominators (transections vs grafts attempted, else extracted; buried / popped vs grafts extracted). Leave blank to enter % manually below.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <FieldShell label="Transected grafts (count)">
            <input className={inputCls} inputMode="numeric" value={transectCount} onChange={(e) => setTransectCount(e.target.value)} />
          </FieldShell>
          <FieldShell label="Buried grafts (count)">
            <input className={inputCls} inputMode="numeric" value={buriedCount} onChange={(e) => setBuriedCount(e.target.value)} />
          </FieldShell>
          <FieldShell label="Popped grafts (count)">
            <input className={inputCls} inputMode="numeric" value={poppedCount} onChange={(e) => setPoppedCount(e.target.value)} />
          </FieldShell>
        </div>

        {(showManualTransect || showManualBuried || showManualPopping) && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
            <p className="text-[11px] font-medium text-slate-600">Manual % (when count not used)</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {showManualTransect ? (
                <FieldShell label="Transection rate %" hint="manual">
                  <input className={inputCls} inputMode="decimal" value={manualTransect} onChange={(e) => setManualTransect(e.target.value)} />
                </FieldShell>
              ) : null}
              {showManualBuried ? (
                <FieldShell label="Buried graft rate %" hint="manual">
                  <input className={inputCls} inputMode="decimal" value={manualBuried} onChange={(e) => setManualBuried(e.target.value)} />
                </FieldShell>
              ) : null}
              {showManualPopping ? (
                <FieldShell label="Popping rate %" hint="manual">
                  <input className={inputCls} inputMode="decimal" value={manualPopping} onChange={(e) => setManualPopping(e.target.value)} />
                </FieldShell>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 shadow-inner sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-900/80">Auto-calculated</p>
          <p className="max-w-md text-[10px] leading-relaxed text-slate-500">
            Estimated mean TOB uses FIFO + uniform phase timing (not graft-level true TOB). Values update as you type; faded values are from the last save until recomputed.
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatReadout
            label="Hair / graft"
            value={disp(derived.hair_to_graft_ratio, "hair_to_graft_ratio", (n) => n.toFixed(3))}
            sub="total hairs ÷ grafts implanted"
          />
          <StatReadout label="Extraction (min)" value={disp(derived.extraction_minutes, "extraction_minutes", (n) => n.toFixed(2))} />
          <StatReadout label="Implantation (min)" value={disp(derived.implantation_minutes, "implantation_minutes", (n) => n.toFixed(2))} />
          <StatReadout label="Total active (min)" value={disp(derived.total_minutes, "total_minutes", (n) => n.toFixed(2))} />
          <StatReadout
            label="Extraction grafts / hr"
            value={disp(derived.extraction_grafts_per_hour, "extraction_grafts_per_hour", (n) => n.toFixed(2))}
          />
          <StatReadout
            label="Implantation grafts / hr"
            value={disp(derived.implantation_grafts_per_hour, "implantation_grafts_per_hour", (n) => n.toFixed(2))}
          />
          <StatReadout
            label="Total hairs (session)"
            value={disp(totalHairsSession, "total_hairs", (n) => String(Math.round(n)))}
            sub="Same as total hairs input — shown for at-a-glance QA"
          />
          <StatReadout
            label="Est. mean TOB"
            value={
              derived.estimated_tob_seconds != null
                ? `${Math.round(derived.estimated_tob_seconds)} s`
                : disp(derived.out_of_body_time_estimate, "out_of_body_time_estimate", (n) => `${n.toFixed(2)} min`)
            }
            sub={
              derived.estimated_tob_seconds != null
                ? `${(derived.estimated_tob_seconds / 60).toFixed(2)} min · FIFO phase estimate`
                : "Enter all four phase times for the estimate"
            }
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StatReadout label="Transection %" value={disp(derived.transection_rate, "transection_rate", (n) => n.toFixed(3))} />
          <StatReadout label="Buried %" value={disp(derived.buried_graft_rate, "buried_graft_rate", (n) => n.toFixed(3))} />
          <StatReadout label="Popping %" value={disp(derived.popping_rate, "popping_rate", (n) => n.toFixed(3))} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 sm:hidden"
        >
          {busy ? "Saving…" : "Save metrics"}
        </button>
        {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
      </div>
    </form>
  );
}
