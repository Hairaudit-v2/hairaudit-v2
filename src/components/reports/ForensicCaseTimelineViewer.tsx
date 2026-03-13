"use client";

import { useEffect, useMemo, useState } from "react";

type TimelineStage =
  | "preop"
  | "day0"
  | "early_healing"
  | "month_1_3"
  | "month_4_6"
  | "month_7_12"
  | "month_12_plus"
  | "unknown";

type MaturityStatus = "Early" | "Developing" | "Near-final" | "Final-stage review";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  created_at?: string;
};

type StageItem = {
  upload: UploadRow;
  stage: TimelineStage;
  reason: string;
};

type StageStatus = "available" | "limited" | "missing";

type StageInfo = {
  key: TimelineStage;
  label: string;
  short: string;
};

type TimelineObservation = {
  stage: TimelineStage;
  text: string;
};

const STAGES: StageInfo[] = [
  { key: "preop", label: "Pre-op", short: "Pre-op" },
  { key: "day0", label: "Day 0", short: "Day 0" },
  { key: "early_healing", label: "Early Healing", short: "Early" },
  { key: "month_1_3", label: "1–3 months", short: "1-3m" },
  { key: "month_4_6", label: "4–6 months", short: "4-6m" },
  { key: "month_7_12", label: "7–12 months", short: "7-12m" },
  { key: "month_12_plus", label: "12m+", short: "12m+" },
];

function monthLabel(v: number | null) {
  if (typeof v !== "number" || Number.isNaN(v)) return "Unknown";
  if (v < 1) return "<1 month";
  return `${Math.floor(v)} month${Math.floor(v) === 1 ? "" : "s"}`;
}

function formatDate(v: string | null | undefined) {
  if (!v) return "Not provided";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Not provided";
  return d.toLocaleDateString();
}

function stageFromMonths(months: number | null): TimelineStage {
  if (typeof months !== "number" || Number.isNaN(months)) return "unknown";
  if (months < 0.3) return "day0";
  if (months < 1) return "early_healing";
  if (months < 4) return "month_1_3";
  if (months < 7) return "month_4_6";
  if (months < 12) return "month_7_12";
  return "month_12_plus";
}

function maturityFromMonths(months: number | null): MaturityStatus {
  if (typeof months !== "number" || Number.isNaN(months)) return "Early";
  if (months < 3) return "Early";
  if (months < 7) return "Developing";
  if (months < 12) return "Near-final";
  return "Final-stage review";
}

function mapUploadToStage(upload: UploadRow, monthsSinceSurgery: number | null): { stage: TimelineStage; reason: string } {
  const t = String(upload.type ?? "").toLowerCase();
  const key = t.includes(":") ? t.split(":")[1] : t;

  if (key.includes("preop") || key.includes("pre-op") || key.includes("pre_procedure") || key.includes("any_preop")) {
    return { stage: "preop", reason: "pre-op key detected" };
  }
  if (
    key.includes("day0") ||
    key.includes("day-0") ||
    key.includes("intraop") ||
    key.includes("surgery") ||
    key.includes("day_of") ||
    key.includes("any_day0")
  ) {
    return { stage: "day0", reason: "surgery-day key detected" };
  }
  if (
    key.includes("postop_day0_3") ||
    key.includes("postop_day0") ||
    key.includes("early") ||
    key.includes("healing")
  ) {
    return { stage: "early_healing", reason: "early healing key detected" };
  }
  if (key.includes("month1") || key.includes("month2") || key.includes("month3") || key.includes("m1") || key.includes("m2") || key.includes("m3")) {
    return { stage: "month_1_3", reason: "1-3 month key detected" };
  }
  if (key.includes("month4") || key.includes("month5") || key.includes("month6") || key.includes("m4") || key.includes("m5") || key.includes("m6")) {
    return { stage: "month_4_6", reason: "4-6 month key detected" };
  }
  if (
    key.includes("month7") ||
    key.includes("month8") ||
    key.includes("month9") ||
    key.includes("month10") ||
    key.includes("month11") ||
    key.includes("month12") ||
    key.includes("m7") ||
    key.includes("m8") ||
    key.includes("m9")
  ) {
    return { stage: "month_7_12", reason: "7-12 month key detected" };
  }
  if (key.includes("12_plus") || key.includes("12m_plus") || key.includes("year") || key.includes("final")) {
    return { stage: "month_12_plus", reason: "12+ month key detected" };
  }

  // Current-state patient evidence follows surgery maturity if explicit stage is absent.
  if (key.startsWith("patient_current_")) {
    const inferred = stageFromMonths(monthsSinceSurgery);
    return { stage: inferred, reason: "mapped from patient_current + months_since_surgery" };
  }
  return { stage: "unknown", reason: "no stage pattern matched" };
}

function nodeStatus(count: number): StageStatus {
  if (count <= 0) return "missing";
  if (count === 1) return "limited";
  return "available";
}

function statusBadge(status: StageStatus) {
  if (status === "available") return "✓ Evidence available";
  if (status === "limited") return "⚠ Limited evidence";
  return "✕ Missing evidence";
}

function statusColor(status: StageStatus) {
  if (status === "available") return "border-emerald-300/50 bg-emerald-400/20 text-emerald-100";
  if (status === "limited") return "border-amber-300/50 bg-amber-400/20 text-amber-100";
  return "border-rose-300/50 bg-rose-400/20 text-rose-100";
}

function maturityColor(maturity: MaturityStatus) {
  if (maturity === "Final-stage review") return "border-emerald-300/40 bg-emerald-300/15 text-emerald-100";
  if (maturity === "Near-final") return "border-cyan-300/40 bg-cyan-300/15 text-cyan-100";
  if (maturity === "Developing") return "border-amber-300/40 bg-amber-300/15 text-amber-100";
  return "border-violet-300/40 bg-violet-300/15 text-violet-100";
}

function confLabel(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  if (!s) return "Pending";
  return s.toUpperCase();
}

export default function ForensicCaseTimelineViewer(props: {
  caseId: string;
  auditType: string;
  procedureDate: string | null;
  monthsSinceSurgery: number | null;
  confidenceLabel: string | null;
  uploads: UploadRow[];
  giiNotes?: string | null;
  giiLimitations?: string[];
  aiObservations?: TimelineObservation[];
}) {
  const [selectedStage, setSelectedStage] = useState<TimelineStage>("preop");
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});

  const maturity = useMemo(() => maturityFromMonths(props.monthsSinceSurgery), [props.monthsSinceSurgery]);

  const stageItems = useMemo(() => {
    return props.uploads.map((upload) => {
      const mapped = mapUploadToStage(upload, props.monthsSinceSurgery);
      return { upload, stage: mapped.stage, reason: mapped.reason } as StageItem;
    });
  }, [props.uploads, props.monthsSinceSurgery]);

  const groupedByStage = useMemo(() => {
    const out: Record<TimelineStage, StageItem[]> = {
      preop: [],
      day0: [],
      early_healing: [],
      month_1_3: [],
      month_4_6: [],
      month_7_12: [],
      month_12_plus: [],
      unknown: [],
    };
    for (const item of stageItems) out[item.stage].push(item);
    return out;
  }, [stageItems]);

  const completeness = useMemo(() => {
    const requiredByMaturity: Record<MaturityStatus, TimelineStage[]> = {
      Early: ["preop", "day0", "early_healing"],
      Developing: ["preop", "day0", "early_healing", "month_1_3"],
      "Near-final": ["preop", "day0", "month_1_3", "month_4_6", "month_7_12"],
      "Final-stage review": ["preop", "day0", "month_1_3", "month_4_6", "month_7_12", "month_12_plus"],
    };
    const requiredStages = requiredByMaturity[maturity];
    const present = requiredStages.filter((k) => groupedByStage[k].length > 0).length;
    const score = requiredStages.length ? Math.round((present / requiredStages.length) * 100) : 0;
    return { requiredStages, score };
  }, [groupedByStage, maturity]);

  const hasFinalOutcomeImages = groupedByStage.month_12_plus.length > 0;

  const missingAlerts = useMemo(() => {
    const alerts: string[] = [];
    for (const stage of completeness.requiredStages) {
      if (groupedByStage[stage].length === 0) {
        const label = STAGES.find((s) => s.key === stage)?.label ?? stage;
        alerts.push(`Missing ${label}`);
      }
    }
    const hasDay0Donor = stageItems.some((s) => s.stage === "day0" && s.upload.type.toLowerCase().includes("donor"));
    if (!hasDay0Donor) alerts.push("Missing Day 0 donor evidence");

    const needsMonth6Donor = (props.monthsSinceSurgery ?? 0) >= 6;
    if (needsMonth6Donor) {
      const hasSixMonthDonor = stageItems.some(
        (s) =>
          s.stage === "month_4_6" &&
          (s.upload.type.toLowerCase().includes("donor") || s.upload.storage_path.toLowerCase().includes("donor"))
      );
      if (!hasSixMonthDonor) alerts.push("Missing 6-month donor photos");
    }
    return alerts;
  }, [completeness.requiredStages, groupedByStage, stageItems, props.monthsSinceSurgery]);

  const recommendedNextEvidence = useMemo(() => {
    if (maturity === "Early") return "Capture clear Day 0 donor and recipient images plus early-healing (Day 1-3) follow-up.";
    if (maturity === "Developing") return "Add 1-3 month standardized front/top/donor views to establish early growth trajectory.";
    if (maturity === "Near-final") return "Add 7-12 month donor + recipient sets to support near-final density and design assessment.";
    return "Add 12m+ standardized outcome set (front, top, donor, crown) for final-stage forensic review.";
  }, [maturity]);

  const stageCounts = useMemo(() => {
    return Object.fromEntries(STAGES.map((stage) => [stage.key, groupedByStage[stage.key].length])) as Record<TimelineStage, number>;
  }, [groupedByStage]);

  const selectedItems = groupedByStage[selectedStage];
  const selectedStatus = nodeStatus(stageCounts[selectedStage] ?? 0);

  const selectedObservations = useMemo(() => {
    const direct = (props.aiObservations ?? []).filter((o) => o.stage === selectedStage).map((o) => o.text);
    if (direct.length > 0) return direct.slice(0, 3);
    if ((props.aiObservations ?? []).length > 0) return (props.aiObservations ?? []).map((o) => o.text).slice(0, 2);
    return ["No stage-specific AI observations available yet."];
  }, [props.aiObservations, selectedStage]);

  const stageConcerns = useMemo(() => {
    const concerns: string[] = [];
    if (selectedStage === "month_7_12" || selectedStage === "month_12_plus") {
      if ((props.monthsSinceSurgery ?? 0) < 7) concerns.push("Too early for final density judgment.");
    }
    if (selectedStage === "early_healing" && (props.monthsSinceSurgery ?? 0) < 2) {
      concerns.push("Donor healing still evolving.");
    }
    if (selectedStage === "day0" && groupedByStage.day0.length === 0) {
      concerns.push("No day-0 implantation evidence available.");
    }
    for (const limitation of props.giiLimitations ?? []) {
      concerns.push(limitation);
    }
    if (concerns.length === 0) concerns.push("No major timeline-specific limitations flagged for this stage.");
    return concerns.slice(0, 4);
  }, [selectedStage, props.monthsSinceSurgery, props.giiLimitations, groupedByStage.day0.length]);

  useEffect(() => {
    let active = true;
    async function loadSigned() {
      const targets = selectedItems.slice(0, 12).filter((x) => !(x.upload.id in signedUrls));
      if (targets.length === 0) return;
      const entries = await Promise.all(
        targets.map(async (item) => {
          try {
            const res = await fetch(`/api/uploads/signed-url?path=${encodeURIComponent(item.upload.storage_path)}`);
            const json = (await res.json().catch(() => ({}))) as { url?: string };
            return [item.upload.id, json.url ?? null] as const;
          } catch {
            return [item.upload.id, null] as const;
          }
        })
      );
      if (!active) return;
      setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    }
    void loadSigned();
    return () => {
      active = false;
    };
  }, [selectedItems, signedUrls]);

  return (
    <section className="mt-6 rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Forensic Case Timeline</h2>
          <p className="mt-1 text-sm text-slate-300/80">Timeline-driven evidence review for longitudinal transplant analysis.</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200">
          Timeline completeness: <span className="font-semibold text-cyan-200">{completeness.score}%</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Case ID</p>
          <p className="mt-1 truncate font-mono text-sm text-slate-100">{props.caseId}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Audit Type</p>
          <p className="mt-1 text-sm capitalize text-slate-100">{props.auditType || "patient"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Procedure Date</p>
          <p className="mt-1 text-sm text-slate-100">{formatDate(props.procedureDate)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Months Since Surgery</p>
          <p className="mt-1 text-sm text-slate-100">{monthLabel(props.monthsSinceSurgery)}</p>
        </div>
        <div className={`rounded-xl border p-3 ${maturityColor(maturity)}`}>
          <p className="text-xs uppercase tracking-wide text-slate-300">Case Maturity</p>
          <p className="mt-1 text-sm font-semibold">{maturity}</p>
        </div>
        <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{confLabel(props.confidenceLabel)}</p>
        </div>
      </div>

      {missingAlerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-900/20 p-3">
          <p className="text-sm font-semibold text-amber-100">Missing timeline evidence alert</p>
          <p className="mt-1 text-xs text-amber-100/90">{missingAlerts.slice(0, 3).join(" • ")}</p>
        </div>
      )}

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-[760px] items-start gap-3">
          {STAGES.map((stage, idx) => {
            const count = stageCounts[stage.key] ?? 0;
            const status = nodeStatus(count);
            const active = selectedStage === stage.key;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setSelectedStage(stage.key)}
                className={`group relative w-[104px] shrink-0 rounded-xl border px-2 py-3 text-left transition-all ${
                  active
                    ? "border-cyan-300/60 bg-cyan-300/20 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                    : "border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{stage.short}</div>
                <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusColor(status)}`}>
                  {status === "available" ? "✓" : status === "limited" ? "⚠" : "✕"}
                </div>
                <div className="mt-1 text-[11px] text-slate-300">{count} file{count === 1 ? "" : "s"}</div>
                {idx < STAGES.length - 1 && <span className="absolute -right-2 top-1/2 hidden h-[2px] w-2 -translate-y-1/2 bg-slate-600 md:block" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            Stage Detail: {STAGES.find((x) => x.key === selectedStage)?.label ?? selectedStage}
          </h3>
          <span className={`rounded-md border px-2 py-1 text-xs ${statusColor(selectedStatus)}`}>{statusBadge(selectedStatus)}</span>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Uploaded images</p>
            {selectedItems.length === 0 ? (
              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">No images tagged to this stage.</div>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedItems.slice(0, 9).map((item) => (
                  <article key={item.upload.id} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    <div className="aspect-square bg-slate-800/70">
                      {signedUrls[item.upload.id] ? (
                        <img src={signedUrls[item.upload.id] as string} alt={item.upload.type} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">Preview unavailable</div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[11px] text-slate-300">{item.upload.type.replace(/^patient_photo:|^doctor_photo:|^clinic_photo:/, "")}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Evidence count</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{selectedItems.length} item(s)</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">AI observations</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200/90">
                {selectedObservations.map((obs, i) => (
                  <li key={`${obs}-${i}`}>• {obs}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Auditor notes</p>
              <p className="mt-1 text-sm text-slate-200/90">{props.giiNotes?.trim() ? props.giiNotes : "No auditor notes for this stage yet."}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Evidence quality</p>
              <p className="mt-1 text-sm text-slate-200/90">
                {selectedStatus === "available" ? "Strong stage coverage" : selectedStatus === "limited" ? "Partial stage coverage" : "Insufficient stage coverage"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Timeline-specific concerns / limitations</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200/90">
                {stageConcerns.map((c, i) => (
                  <li key={`${c}-${i}`}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Recommended next evidence</p>
          <p className="mt-1 text-sm text-slate-100">{recommendedNextEvidence}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Final outcome evidence</p>
          <p className="mt-1 text-sm text-slate-100">{hasFinalOutcomeImages ? "Final outcome imagery available" : "No 12m+ outcome imagery yet"}</p>
        </div>
      </div>
    </section>
  );
}
