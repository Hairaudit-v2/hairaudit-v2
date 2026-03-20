"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";

type AuditorStatus = "pending" | "approved" | "rejected" | "needs_more_evidence";
type ConfidenceLabel = "low" | "medium" | "high";

export type GraftIntegrityEstimateRow = {
  id: string;
  case_id: string;
  claimed_grafts: number | null;
  estimated_extracted_min: number | null;
  estimated_extracted_max: number | null;
  estimated_implanted_min: number | null;
  estimated_implanted_max: number | null;
  variance_claimed_vs_implanted_min_pct: number | null;
  variance_claimed_vs_implanted_max_pct: number | null;
  variance_claimed_vs_extracted_min_pct: number | null;
  variance_claimed_vs_extracted_max_pct: number | null;
  confidence: number;
  confidence_label: ConfidenceLabel;
  limitations: string[];
  flags: string[];
  ai_notes: string | null;
  auditor_status: AuditorStatus;
  auditor_notes: string | null;
  auditor_adjustments?: any;
  evidence_sufficiency_score?: number | null;
  inputs_used?: any;
  updated_at: string | null;
  created_at: string | null;
};

function formatInt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${formatInt(min)}–${formatInt(max)}`;
  if (min !== null) return `≥ ${formatInt(min)}`;
  return `≤ ${formatInt(max as number)}`;
}

function formatPctRange(min: number | null, max: number | null): string {
  const fmt = (v: number) => {
    const n = Math.round(v * 10) / 10;
    const sign = n > 0 ? "+" : "";
    return `${sign}${n}%`;
  };
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${fmt(min)}–${fmt(max)}`;
  if (min !== null) return `≥ ${fmt(min)}`;
  return `≤ ${fmt(max as number)}`;
}

export default function GraftIntegrityCard(props: {
  caseId: string | null;
  initialEstimate?: GraftIntegrityEstimateRow | null;
}) {
  const { t } = useI18n();
  const { caseId } = props;
  const [estimate, setEstimate] = useState<GraftIntegrityEstimateRow | null>(props.initialEstimate ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(caseId) && !props.initialEstimate);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const giiSelectWithEvidence =
    "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, evidence_sufficiency_score, inputs_used, created_at, updated_at";
  const giiSelectFallback =
    "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, inputs_used, created_at, updated_at";

  async function loadLatestEstimate(caseIdValue: string) {
    const primaryRes = await supabase
      .from("graft_integrity_estimates")
      .select(giiSelectWithEvidence)
      .eq("case_id", caseIdValue)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!primaryRes.error) {
      return primaryRes;
    }

    if (isMissingFeatureError(primaryRes.error)) {
      const fallbackRes = await supabase
        .from("graft_integrity_estimates")
        .select(giiSelectFallback)
        .eq("case_id", caseIdValue)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return fallbackRes;
    }

    return primaryRes;
  }

  useEffect(() => {
    let alive = true;

    async function loadLatest() {
      if (!caseId) {
        setEstimate(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await loadLatestEstimate(caseId);

      if (!alive) return;
      if (!error) {
        setFeatureUnavailable(false);
        setEstimate((data ?? null) as unknown as GraftIntegrityEstimateRow | null);
      } else if (isMissingFeatureError(error)) {
        // Missing table in this environment: fail open and hide card.
        setFeatureUnavailable(true);
        setEstimate(null);
      }
      setLoading(false);
    }

    void loadLatest();
    return () => {
      alive = false;
    };
  }, [caseId, supabase]);

  useEffect(() => {
    if (!caseId) return;

    if (featureUnavailable) return;

    const channel = supabase
      .channel(`gii:${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "graft_integrity_estimates", filter: `case_id=eq.${caseId}` },
        async () => {
          const { data, error } = await loadLatestEstimate(caseId);
          if (error && isMissingFeatureError(error)) {
            setFeatureUnavailable(true);
            setEstimate(null);
            return;
          }
          setEstimate((data ?? null) as unknown as GraftIntegrityEstimateRow | null);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseId, featureUnavailable, supabase]);

  if (featureUnavailable) return null;

  const status = estimate?.auditor_status ?? "pending";
  const statusBadge = (() => {
    if (status === "approved") {
      return { label: t("dashboard.patient.graftIntegrity.statusApproved"), pill: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" };
    }
    if (status === "needs_more_evidence") {
      return { label: t("dashboard.patient.graftIntegrity.statusNeedsEvidence"), pill: "border-amber-300/20 bg-amber-300/10 text-amber-200" };
    }
    if (status === "rejected") {
      return { label: t("dashboard.patient.graftIntegrity.statusRejected"), pill: "border-rose-300/20 bg-rose-300/10 text-rose-200" };
    }
    return { label: t("dashboard.patient.graftIntegrity.statusPending"), pill: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200" };
  })();
  const confLabel = estimate?.confidence_label ?? "medium";
  const confBadge = (() => {
    if (confLabel === "high")
      return { label: t("dashboard.patient.graftIntegrity.confidenceHigh"), pill: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" };
    if (confLabel === "low")
      return { label: t("dashboard.patient.graftIntegrity.confidenceLow"), pill: "border-amber-300/20 bg-amber-300/10 text-amber-200" };
    return { label: t("dashboard.patient.graftIntegrity.confidenceMedium"), pill: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200" };
  })();

  const showNeedsEvidence = status === "needs_more_evidence";
  // Only approved: high-impact claims (ranges, variance) must never surface to patients when pending/rejected/needs_more_evidence
  const isApproved = status === "approved";
  const limitations = Array.isArray(estimate?.limitations) ? estimate?.limitations : [];
  const shortLimitations = limitations.slice(0, 3);
  const publicNote = String((estimate as any)?.auditor_adjustments?.public_note ?? "").trim();
  const evidenceStrength = (() => {
    const n = estimate?.evidence_sufficiency_score;
    return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  })();
  const recommendedMissing: string[] = Array.isArray((estimate as any)?.inputs_used?.recommended_missing_photos)
    ? (estimate as any).inputs_used.recommended_missing_photos.map(String).filter(Boolean).slice(0, 4)
    : [];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white shadow-sm border border-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19V5" strokeLinecap="round" />
                <path d="M4 19h16" strokeLinecap="round" />
                <path d="M7 15l3-3 3 2 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{t("dashboard.patient.graftIntegrity.title")}</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300/80">{t("dashboard.patient.graftIntegrity.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.pill}`}>
            {statusBadge.label}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confBadge.pill}`}>
            {t("dashboard.patient.graftIntegrity.confidencePrefix")} {confBadge.label}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-medium text-slate-200/70">{t("dashboard.patient.graftIntegrity.claimedGrafts")}</div>
          <div className="mt-1 text-lg font-semibold text-white tabular-nums">
            {estimate?.claimed_grafts !== null && estimate?.claimed_grafts !== undefined
              ? formatInt(estimate.claimed_grafts)
              : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-medium text-slate-200/70">{t("dashboard.patient.graftIntegrity.estimatedExtracted")}</div>
          <div className="mt-1 text-lg font-semibold text-white tabular-nums">
            {estimate && isApproved ? formatRange(estimate.estimated_extracted_min, estimate.estimated_extracted_max) : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-medium text-slate-200/70">{t("dashboard.patient.graftIntegrity.estimatedImplanted")}</div>
          <div className="mt-1 text-lg font-semibold text-white tabular-nums">
            {estimate && isApproved ? formatRange(estimate.estimated_implanted_min, estimate.estimated_implanted_max) : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-medium text-slate-200/70">{t("dashboard.patient.graftIntegrity.varianceVsClaimed")}</div>
          <div className="mt-1 text-sm font-semibold text-white tabular-nums">
            <div>
              {t("dashboard.patient.graftIntegrity.varianceImplanted")}{" "}
              {estimate && isApproved
                ? formatPctRange(estimate.variance_claimed_vs_implanted_min_pct, estimate.variance_claimed_vs_implanted_max_pct)
                : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-200/70">
              {t("dashboard.patient.graftIntegrity.varianceExtracted")}{" "}
              {estimate && isApproved
                ? formatPctRange(estimate.variance_claimed_vs_extracted_min_pct, estimate.variance_claimed_vs_extracted_max_pct)
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs leading-relaxed text-slate-300/75">{t("dashboard.patient.graftIntegrity.aiDisclaimer")}</div>

      {evidenceStrength !== null && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white">{t("dashboard.patient.graftIntegrity.evidenceStrength")}</div>
            <div className="text-xs font-semibold text-slate-200 tabular-nums">{evidenceStrength}/100</div>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
              style={{ width: `${evidenceStrength}%` }}
            />
          </div>
          {evidenceStrength < 60 && (
            <div className="mt-2 text-xs leading-relaxed text-slate-200/80">
              {t("dashboard.patient.graftIntegrity.evidenceLimited")}
              {recommendedMissing.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {recommendedMissing.map((x, i) => (
                    <li key={`${x}-${i}`} className="flex gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-200/70" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-4 text-xs text-slate-200/70">{t("dashboard.patient.graftIntegrity.loading")}</div>
      )}

      {!loading && caseId && !estimate && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-200/80">
          {t("dashboard.patient.graftIntegrity.emptyState")}
        </div>
      )}

      {!isApproved && status === "pending" && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-200/80">
          {t("dashboard.patient.graftIntegrity.pendingReview")}
        </div>
      )}

      {estimate?.auditor_status === "rejected" && estimate?.ai_notes && (
        <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/5 p-4">
          <div className="text-xs font-semibold text-rose-200">{t("dashboard.patient.graftIntegrity.explanation")}</div>
          <div className="mt-1 text-xs text-slate-200/80">
            {publicNote || estimate.ai_notes}
          </div>
        </div>
      )}

      {showNeedsEvidence && (
        <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-amber-200">{t("dashboard.patient.graftIntegrity.recommendedNextStep")}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-200/80">
                {t("dashboard.patient.graftIntegrity.needsEvidenceBody")}
              </div>
              {publicNote && (
                <div className="mt-2 text-xs text-slate-200/80">{publicNote}</div>
              )}
            </div>
            {caseId && (
              <Link
                href={`/cases/${caseId}/patient/photos`}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
              >
                {t("dashboard.patient.graftIntegrity.uploadRecommendedPhotos")}
              </Link>
            )}
          </div>

          {shortLimitations.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-200/80">
              {shortLimitations.map((x, i) => (
                <li key={`${x}-${i}`} className="flex gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-200/70" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {estimate?.ai_notes && isApproved && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-white">{t("dashboard.patient.graftIntegrity.aiNotesHeading")}</div>
          <div className="mt-1 text-xs text-slate-200/80">{estimate.ai_notes}</div>
          {estimate.updated_at && (
            <div className="mt-2 text-[11px] text-slate-300/60">
              {t("dashboard.patient.graftIntegrity.updatedPrefix")} {new Date(estimate.updated_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

