import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyProjectionStoragePath } from "@/lib/preSurgeryIntelligence/projectionAssetStatus";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";
import type { PreSurgeryIllustrativeProjection } from "@/lib/preSurgeryIntelligence/types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "@/lib/preSurgeryIntelligence/types";

/**
 * HA-PRE-SURGERY-PROJECTION-VISIBILITY-FIX — Discoverable Surgery Projection Plan on case file.
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
      .select("id, mode, status, storage_path, graft_plan_version, patient_sharing_enabled, payload, requested_at, approved_at")
      .eq("case_id", caseId)
      .order("requested_at", { ascending: false })
      .limit(6),
  ]);

  const approvedPlan =
    (planRows ?? []).find((p) => p.status === "approved") ?? (planRows ?? [])[0] ?? null;
  const projections = (projectionRows ?? []).map((row) => {
    const payload = row.payload as PreSurgeryIllustrativeProjection | null;
    return {
      id: String(row.id),
      mode: String(row.mode),
      status: String(row.status),
      storagePath: row.storage_path ? String(row.storage_path) : payload?.storagePath ?? null,
      graftPlanVersion: Number(row.graft_plan_version ?? payload?.graftPlanVersion ?? 0),
      patientSharingEnabled: row.patient_sharing_enabled === true,
      label:
        payload?.patientSafeLabel ??
        PRE_SURGERY_PROJECTION_PATIENT_LABELS[
          row.mode as keyof typeof PRE_SURGERY_PROJECTION_PATIENT_LABELS
        ] ??
        String(row.mode),
      approvedAt: row.approved_at ? String(row.approved_at) : null,
    };
  });

  const latest = projections[0] ?? null;
  const asset = classifyProjectionStoragePath(latest?.storagePath);
  let thumbUrl: string | null = null;
  if (latest && asset.canAttemptSignedUrl && asset.storagePath) {
    const bucket = getCaseFilesBucketNameForReadOnlyUse();
    const { data } = await admin.storage.from(bucket).createSignedUrl(asset.storagePath, 60 * 10);
    thumbUrl = data?.signedUrl ?? null;
  }

  const workspaceHref = `/cases/${caseId}/professional/pre-surgery-review#psi-surgery-projection-plan`;

  return (
    <div
      className="mb-4 overflow-hidden rounded-md border border-[var(--ha-border)] bg-[var(--ha-card)]"
      data-testid="surgery-projection-plan-case-card"
    >
      <div className="flex flex-wrap gap-0">
        <div className="flex h-28 w-36 shrink-0 items-center justify-center bg-[var(--ha-muted)]/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-[var(--ha-muted-foreground)]">
              {latest
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
          <p className="font-medium text-[var(--ha-foreground)]">
            {approvedPlan
              ? `Graft plan ${approvedPlan.status} · v${approvedPlan.version}`
              : "No graft plan yet"}
            {latest
              ? ` · ${latest.label}: ${latest.status}`
              : " · no illustrative projection"}
          </p>
          <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">
            {latest?.patientSharingEnabled
              ? "Patient sharing enabled for approved imagery"
              : "Illustrative imagery remains clinician-only until approved for sharing"}
            {latest && approvedPlan && latest.graftPlanVersion !== Number(approvedPlan.version)
              ? ` · projection tied to plan v${latest.graftPlanVersion}`
              : ""}
          </p>
          <Link
            href={workspaceHref}
            className="mt-2 inline-block font-medium text-[var(--ha-primary)] underline"
          >
            Open Surgery Projection Plan workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
