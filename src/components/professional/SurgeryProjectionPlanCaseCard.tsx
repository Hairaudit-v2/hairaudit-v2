import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyProjectionStoragePath } from "@/lib/preSurgeryIntelligence/projectionAssetStatus";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";
import type { PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection } from "@/lib/preSurgeryIntelligence/types";
import { computeGraftPlanTotals } from "@/lib/preSurgeryIntelligence/graftPlanTotals";
import {
  ILLUSTRATIVE_SURGERY_PLAN_LABEL,
  ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT,
  labelForProjectionProvider,
} from "@/lib/preSurgeryIntelligence/projectionDisplayCopy";
import { clinicianProjectionLifecycleLabel } from "@/lib/preSurgeryIntelligence/projectionAssetStatus";

/**
 * HA-PRE-SURGERY-PROJECTION-LIVE-ACCEPTANCE-1B — Discoverable Surgery Projection Plan on case file.
 */
export default async function SurgeryProjectionPlanCaseCard({ caseId }: { caseId: string }) {
  const admin = createSupabaseAdminClient();
  const [{ data: planRows }, { data: projectionRows }] = await Promise.all([
    admin
      .from("hairaudit_pre_surgery_graft_plans")
      .select("id, version, status, payload")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(5),
    admin
      .from("hairaudit_pre_surgery_projections")
      .select(
        "id, mode, status, storage_path, graft_plan_version, patient_sharing_enabled, payload, requested_at, approved_at, provider_id"
      )
      .eq("case_id", caseId)
      .order("requested_at", { ascending: false })
      .limit(12),
  ]);

  const approvedPlanRow =
    (planRows ?? []).find((p) => p.status === "approved") ?? (planRows ?? [])[0] ?? null;
  const approvedPlanPayload = (approvedPlanRow?.payload ?? null) as PreSurgeryGraftPlan | null;
  const graftTotals = approvedPlanPayload
    ? computeGraftPlanTotals(approvedPlanPayload.zones ?? [])
    : null;

  const projections = (projectionRows ?? []).map((row) => {
    const payload = row.payload as PreSurgeryIllustrativeProjection | null;
    const providerId = String(row.provider_id ?? payload?.providerId ?? "");
    const display = labelForProjectionProvider(providerId);
    return {
      id: String(row.id),
      mode: String(row.mode),
      status: String(row.status),
      storagePath: row.storage_path ? String(row.storage_path) : payload?.storagePath ?? null,
      graftPlanVersion: Number(row.graft_plan_version ?? payload?.graftPlanVersion ?? 0),
      patientSharingEnabled: row.patient_sharing_enabled === true,
      providerId,
      displayLabel: display.label,
      approvedAt: row.approved_at ? String(row.approved_at) : null,
    };
  });

  // Prefer current approved-plan + real-image projection for the card spotlight.
  const preferred =
    projections.find(
      (p) =>
        approvedPlanRow &&
        p.graftPlanVersion === Number(approvedPlanRow.version) &&
        p.status === "approved" &&
        classifyProjectionStoragePath(p.storagePath).kind === "image"
    ) ??
    projections.find(
      (p) =>
        approvedPlanRow &&
        p.graftPlanVersion === Number(approvedPlanRow.version) &&
        classifyProjectionStoragePath(p.storagePath).kind === "image"
    ) ??
    projections[0] ??
    null;

  const asset = classifyProjectionStoragePath(preferred?.storagePath);
  let thumbUrl: string | null = null;
  if (preferred && asset.canAttemptSignedUrl && asset.storagePath) {
    const bucket = getCaseFilesBucketNameForReadOnlyUse();
    const { data } = await admin.storage.from(bucket).createSignedUrl(asset.storagePath, 60 * 10);
    thumbUrl = data?.signedUrl ?? null;
  }

  const workspaceHref = `/cases/${caseId}/professional/pre-surgery-review#psi-surgery-projection-plan`;
  const sharingState = preferred
    ? preferred.patientSharingEnabled
      ? "Patient sharing on"
      : "Clinician-only"
    : "—";

  return (
    <div
      className="mb-4 overflow-hidden rounded-md border-2 border-[var(--ha-primary)]/35 bg-[var(--ha-card)] shadow-sm"
      data-testid="surgery-projection-plan-case-card"
    >
      <div className="flex flex-wrap gap-0">
        <div className="flex h-32 w-40 shrink-0 items-center justify-center bg-[var(--ha-muted)]/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={`${ILLUSTRATIVE_SURGERY_PLAN_LABEL} thumbnail`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-[var(--ha-muted-foreground)]">
              {preferred
                ? asset.kind === "stub_placeholder"
                  ? "Stub — no image file"
                  : "No preview"
                : "No projection yet"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 px-4 py-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
            Surgery Projection Plan
          </p>
          <p className="text-base font-semibold text-[var(--ha-foreground)]">
            {ILLUSTRATIVE_SURGERY_PLAN_LABEL}
          </p>
          <p className="mt-1 font-medium text-[var(--ha-foreground)]">
            {approvedPlanRow
              ? `Plan ${approvedPlanRow.status} · v${approvedPlanRow.version}`
              : "No graft plan yet"}
            {graftTotals
              ? ` · ${graftTotals.totalTargetGrafts.toLocaleString()} target grafts`
              : ""}
          </p>
          <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">
            {preferred
              ? `${clinicianProjectionLifecycleLabel(preferred.status)} · ${sharingState}`
              : "No illustrative imagery yet"}
            {preferred && approvedPlanRow && preferred.graftPlanVersion !== Number(approvedPlanRow.version)
              ? ` · imagery tied to plan v${preferred.graftPlanVersion}`
              : ""}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--ha-muted-foreground)]">
            {preferred
              ? labelForProjectionProvider(preferred.providerId).supportingText
              : ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT}
          </p>
          <Link
            href={workspaceHref}
            className="mt-3 inline-block font-medium text-[var(--ha-primary)] underline"
            data-testid="surgery-projection-plan-case-card-link"
          >
            Open professional planning workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
