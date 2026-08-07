"use client";

/**
 * HA-PRE-SURGERY-PROJECTION-VISIBILITY-FIX — Prominent Surgery Projection Plan summary.
 * Graft/surgical plan vs illustrative projected outcome vs correction are labeled distinctly.
 */

import type { PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection } from "@/lib/preSurgeryIntelligence/types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "@/lib/preSurgeryIntelligence/types";
import { computeGraftPlanTotals } from "@/lib/preSurgeryIntelligence/graftPlanTotals";
import {
  classifyProjectionStoragePath,
  clinicianProjectionLifecycleLabel,
  projectionMatchesCurrentPlan,
} from "@/lib/preSurgeryIntelligence/projectionAssetStatus";

export type ProjectionMediaState = {
  projectionId: string;
  assetKind: ReturnType<typeof classifyProjectionStoragePath>["kind"];
  assetMessage: string;
  sourceSignedUrl: string | null;
  projectedSignedUrl: string | null;
  loadError: string | null;
};

type Props = {
  caseId: string;
  approvedPlan: PreSurgeryGraftPlan | null;
  currentPlan: PreSurgeryGraftPlan | null;
  projections: PreSurgeryIllustrativeProjection[];
  mediaByProjectionId: Record<string, ProjectionMediaState>;
  busy: boolean;
  onScrollToPlan: () => void;
  onGenerate: (mode: PreSurgeryIllustrativeProjection["mode"]) => void;
  onRetryFailed: (projection: PreSurgeryIllustrativeProjection) => void;
  onReplace: (projection: PreSurgeryIllustrativeProjection) => void;
  onOpenApprove: (projection: PreSurgeryIllustrativeProjection) => void;
  onJumpToProjection: (projectionId: string) => void;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SurgeryProjectionPlanSummary({
  approvedPlan,
  currentPlan,
  projections,
  mediaByProjectionId,
  busy,
  onScrollToPlan,
  onGenerate,
  onRetryFailed,
  onReplace,
  onOpenApprove,
  onJumpToProjection,
}: Props) {
  const plan = approvedPlan ?? currentPlan;
  const totals = plan ? computeGraftPlanTotals(plan.zones) : null;
  const latest =
    [...projections].sort((a, b) => String(b.generatedAt ?? b.requestedAt).localeCompare(String(a.generatedAt ?? a.requestedAt)))[0] ??
    null;

  return (
    <section
      id="psi-surgery-projection-plan"
      data-testid="psi-surgery-projection-plan"
      className="scroll-mt-4 space-y-4 rounded-lg border-2 border-[var(--ha-primary)]/40 bg-[var(--ha-card)] p-4 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
            Surgery Projection Plan
          </p>
          <h2 className="text-lg font-semibold text-[var(--ha-foreground)]">
            Graft plan + illustrative projected outcome
          </h2>
          <p className="mt-1 text-sm text-[var(--ha-muted-foreground)]">
            Distinct from source photos and from forensic correction requests. Illustrative images are planning aids —
            not guaranteed results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-xs font-medium"
            data-testid="psi-spp-view-full-plan"
            onClick={onScrollToPlan}
          >
            View full plan
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-xs font-medium"
            data-testid="psi-spp-edit-graft-plan"
            onClick={onScrollToPlan}
          >
            Edit graft plan
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-[var(--ha-border)] p-3 text-sm">
          <div className="text-[11px] font-semibold uppercase text-[var(--ha-muted-foreground)]">
            Graft / surgical plan
          </div>
          {plan ? (
            <>
              <div className="mt-1 font-medium">
                Status {plan.status} · v{plan.version}
              </div>
              <div className="text-xs text-[var(--ha-muted-foreground)]">
                Target {totals?.totalTargetGrafts.toLocaleString() ?? "—"} grafts
                {" · "}
                min {totals?.totalMinimumGrafts.toLocaleString() ?? "—"} / max{" "}
                {totals?.totalMaximumGrafts.toLocaleString() ?? "—"}
              </div>
              <ul className="mt-2 max-h-28 space-y-0.5 overflow-auto text-xs text-[var(--ha-muted-foreground)]">
                {plan.zones.map((z) => (
                  <li key={z.zone} className="flex justify-between gap-2">
                    <span className="capitalize">{z.zone.replaceAll("_", " ")}</span>
                    <span>
                      {z.priority === "defer" ? "deferred" : `${z.targetGrafts.toLocaleString()} tgt`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-xs text-amber-800">No graft plan yet. Initialise or save a plan below.</p>
          )}
        </div>

        <div className="rounded-md border border-[var(--ha-border)] p-3 text-sm sm:col-span-2">
          <div className="text-[11px] font-semibold uppercase text-[var(--ha-muted-foreground)]">
            Illustrative projected outcome
          </div>
          {!approvedPlan ? (
            <p className="mt-2 text-sm text-amber-800" data-testid="psi-spp-empty-needs-plan">
              Approve a graft plan before generating illustrative projections.
            </p>
          ) : projections.length === 0 ? (
            <div className="mt-2 space-y-2" data-testid="psi-spp-empty-no-projections">
              <p className="text-sm text-[var(--ha-muted-foreground)]">
                No illustrative projection records on this case yet.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["planned", "conservative", "optimistic_within_approved_range"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={busy}
                    className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
                    data-testid={`psi-spp-generate-${mode}`}
                    onClick={() => onGenerate(mode)}
                  >
                    Generate {PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projections.map((p) => {
                const media = mediaByProjectionId[p.id];
                const match = projectionMatchesCurrentPlan({
                  projectionGraftPlanId: p.graftPlanId,
                  projectionGraftPlanVersion: p.graftPlanVersion,
                  currentApprovedPlanId: approvedPlan?.id ?? null,
                  currentApprovedPlanVersion: approvedPlan?.version ?? null,
                });
                const asset = classifyProjectionStoragePath(p.storagePath);
                const failed = p.status === "failed" || p.status === "validation_failed";
                const showImg = Boolean(media?.projectedSignedUrl);
                return (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-md border border-[var(--ha-border)] bg-[var(--ha-background)]"
                    data-testid={`psi-spp-thumb-${p.mode}`}
                  >
                    <div className="relative flex h-36 items-center justify-center bg-[var(--ha-muted)]/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {showImg ? (
                        <img
                          src={media!.projectedSignedUrl!}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : media?.sourceSignedUrl && asset.kind === "stub_placeholder" ? (
                        <div className="relative h-full w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={media.sourceSignedUrl}
                            alt=""
                            className="h-full w-full object-cover opacity-40"
                          />
                          <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-semibold text-amber-950">
                            Stub provider — no projected image file
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-[var(--ha-muted-foreground)]">
                          {failed
                            ? "Generation failed"
                            : media?.loadError
                              ? "Asset loading error"
                              : asset.message}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-2 text-xs">
                      <div className="font-medium">{p.patientSafeLabel}</div>
                      <div className="text-[var(--ha-muted-foreground)]">
                        {clinicianProjectionLifecycleLabel(p.status)}
                        {p.patientSharingEnabled ? " · patient sharing on" : " · clinician-only"}
                        {" · "}plan v{p.graftPlanVersion}
                      </div>
                      {!match.matches ? (
                        <p className="text-amber-800">{match.reason}</p>
                      ) : null}
                      {media?.loadError ? (
                        <p className="text-red-700" data-testid={`psi-spp-asset-error-${p.mode}`}>
                          Asset loading error: {media.loadError}
                        </p>
                      ) : null}
                      <p className="text-[10px] text-[var(--ha-muted-foreground)]">
                        Prepared {formatWhen(p.generatedAt ?? p.requestedAt)}
                        {p.approvedAt ? ` · reviewed ${formatWhen(p.approvedAt)}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button
                          type="button"
                          className="rounded border px-2 py-0.5"
                          onClick={() => onJumpToProjection(p.id)}
                        >
                          Open details
                        </button>
                        {(p.status === "generated" || p.status === "clinician_review") && (
                          <button
                            type="button"
                            className="rounded border px-2 py-0.5"
                            disabled={busy}
                            data-testid={`psi-spp-approve-${p.mode}`}
                            onClick={() => onOpenApprove(p)}
                          >
                            Approve for patient report
                          </button>
                        )}
                        {failed ? (
                          <button
                            type="button"
                            className="rounded border border-red-300 px-2 py-0.5 text-red-800"
                            disabled={busy}
                            data-testid={`psi-spp-retry-${p.mode}`}
                            onClick={() => onRetryFailed(p)}
                          >
                            Retry failed generation
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded border px-2 py-0.5"
                            disabled={busy || !approvedPlan}
                            data-testid={`psi-spp-replace-${p.mode}`}
                            onClick={() => onReplace(p)}
                          >
                            Replace projection
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {latest && projections.length > 0 ? (
            <p className="mt-3 text-[11px] text-[var(--ha-muted-foreground)]">
              Latest: {latest.patientSafeLabel} · {clinicianProjectionLifecycleLabel(latest.status)} ·{" "}
              {formatWhen(latest.generatedAt ?? latest.requestedAt)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
