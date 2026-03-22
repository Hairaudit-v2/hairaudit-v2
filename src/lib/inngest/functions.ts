import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import { type AuditMode } from "@/lib/pdf/reportBuilder";
import { runAIAudit } from "@/lib/ai/audit";
import { buildPatientImageEvidenceGroups } from "@/lib/audit/patientAiImageEvidence";
import { buildPatientImageEvidenceConfidence } from "@/lib/audit/patientImageEvidenceConfidence";
import { isAiExtendedImageEvidenceEnabled } from "@/lib/features/enableAiExtendedImageEvidence";
import { runGraftIntegrityModelEstimate } from "@/lib/ai/graftIntegrity";
import { runDoctorScoringNarrative, DEFAULT_PROTOCOL_CATALOG, DEFAULT_TRAINING_MODULE_CATALOG } from "@/lib/ai/runDoctorScoringNarrative";
import { notifyPatientAuditFailed, notifyAuditorAuditFailed, notifyPatientReportReady, notifyAuditorNewAuditSubmitted } from "@/lib/email";
import { computeDomainScoresV1, computeDoctorAiContextV1 } from "@/lib/benchmarks/domainScoring";
import { renderAndUploadPdfForCase } from "@/lib/reports/renderPdfInternal";
import { normalizeIntakeFormData, toNestedForApi } from "@/lib/intake/normalizeIntakeFormData";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import {
  evaluatePatientPhotoSubmitGate,
  PATIENT_ALTERNATE_OUTCOME_SUBMIT_HINT,
} from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import { isPatientPhotoStageAwareSubmitEnabled } from "@/lib/features/enablePatientPhotoStageAwareSubmit";
import { shouldGeneratePdf } from "@/lib/reports/pdfReadiness";
import {
  loadPreparedModelImageInputs,
  prepareCaseEvidenceManifest,
  type PreparedImageManifestItem,
} from "@/lib/evidence/prepareCaseEvidence";
import { computeAuditorReviewEligibility, computeProvisionalFromScore, computeAwardContributionWeight } from "@/lib/auditor/eligibility";
import { refreshTransparencyMetricsForCase } from "@/lib/transparency/refreshOrchestration";
import { isPatientUploadAuditExcluded } from "@/lib/uploads/patientPhotoAuditMeta";

/** Must match `REASONS` in `src/app/api/auditor/rerun/route.ts`. */
const AUDITOR_RERUN_REASON_CORRECTED_PATIENT_PHOTOS = "corrected_patient_photos";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

// Minimal required categories for “submit”
function isImageUpload(type: string): boolean {
  const t = String(type ?? "").toLowerCase();
  return t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png") || t.includes("jpeg") || t.includes("webp");
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function getNested(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function pickClaimedGrafts(patientAnswers: Record<string, unknown> | null): number | null {
  if (!patientAnswers || typeof patientAnswers !== "object") return null;
  return (
    toIntOrNull((patientAnswers as any).graft_number_received) ??
    toIntOrNull((patientAnswers as any).grafts_claimed_total) ??
    toIntOrNull(getNested(patientAnswers, "enhanced_patient_answers.procedure_execution.grafts_claimed_total")) ??
    toIntOrNull(getNested(patientAnswers, "procedure_execution.grafts_claimed_total"))
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type PipelinePhaseStatus =
  | "processing"
  | "evidence_preparing"
  | "evidence_ready"
  | "audit_running"
  | "audit_complete"
  | "pdf_pending"
  | "pdf_ready"
  | "audit_failed"
  | "failed";

async function setCasePipelineStatus(
  supabase: ReturnType<typeof supabaseAdmin>,
  caseId: string,
  status: PipelinePhaseStatus
) {
  const fallbackMap: Record<PipelinePhaseStatus, string> = {
    processing: "processing",
    evidence_preparing: "processing",
    evidence_ready: "processing",
    audit_running: "processing",
    audit_complete: "processing",
    pdf_pending: "processing",
    pdf_ready: "complete",
    audit_failed: "audit_failed",
    failed: "audit_failed",
  };
  let res = await supabase.from("cases").update({ status }).eq("id", caseId);
  if (!res.error) return;
  const fb = fallbackMap[status];
  if (fb && fb !== status) {
    res = await supabase.from("cases").update({ status: fb }).eq("id", caseId);
  }
  if (res.error) throw new Error(`cases status update failed (${status}): ${res.error.message}`);
}

async function setReportPipelineStatus(
  supabase: ReturnType<typeof supabaseAdmin>,
  caseId: string,
  version: number,
  status: PipelinePhaseStatus,
  extra?: { error?: string | null; pdf_path?: string | null }
) {
  const fallbackMap: Record<PipelinePhaseStatus, string> = {
    processing: "processing",
    evidence_preparing: "processing",
    evidence_ready: "processing",
    audit_running: "processing",
    audit_complete: "processing",
    pdf_pending: "processing",
    pdf_ready: "complete",
    audit_failed: "failed",
    failed: "failed",
  };
  const payload = { status, ...(extra ?? {}) } as Record<string, unknown>;
  let res = await supabase.from("reports").update(payload).eq("case_id", caseId).eq("version", version);
  if (!res.error) return;
  const fb = fallbackMap[status];
  if (fb && fb !== status) {
    res = await supabase
      .from("reports")
      .update({ ...payload, status: fb })
      .eq("case_id", caseId)
      .eq("version", version);
  }
  if (res.error) throw new Error(`reports status update failed (${status}): ${res.error.message}`);
}

function classifyEvidenceCoverage(params: {
  claimedGrafts: number | null;
  donor: Array<{ type?: string; storage_path?: string; metadata?: any }>;
  recipient: Array<{ type?: string; storage_path?: string; metadata?: any }>;
}) {
  const donorCount = params.donor.length;
  const recipientCount = params.recipient.length;

  const hasClaimed = params.claimedGrafts !== null && params.claimedGrafts !== undefined;

  const donorRear = params.donor.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    return (
      cat.includes("donor_rear") ||
      t.includes("donor_rear") ||
      cat.includes("preop_donor_rear") ||
      t.includes("preop_donor_rear") ||
      cat.includes("patient_current_donor_rear") ||
      t.includes("patient_current_donor_rear")
    );
  });

  const donorIntraOrDay0 = params.donor.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    return (
      t.includes("day0_donor") ||
      cat.includes("day0_donor") ||
      t.includes("intraop") ||
      cat.includes("intraop") ||
      cat.includes("any_day0") ||
      t.includes("any_day0")
    );
  });

  const recipientDay0 = params.recipient.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    return t.includes("day0_recipient") || cat.includes("day0_recipient") || cat.includes("any_day0") || t.includes("any_day0");
  });

  const recipientIntra = params.recipient.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    return t.includes("intraop") || cat.includes("intraop");
  });

  const recipientEarly = params.recipient.some((u) => {
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    return cat.includes("any_early_postop") || cat.includes("postop") || cat.includes("postop_day0") || cat.includes("postop_day0_3");
  });

  const recommendedMissingPhotos: string[] = [];
  if (!donorRear) recommendedMissingPhotos.push("Donor rear (wide + close-up)");
  if (!donorIntraOrDay0) recommendedMissingPhotos.push("Day 0 donor or intra-op donor close-ups");
  if (!recipientDay0) recommendedMissingPhotos.push("Day 0 recipient close-ups");
  if (!recipientIntra) recommendedMissingPhotos.push("Intra-op recipient close-ups (if available)");
  if (!recipientEarly) recommendedMissingPhotos.push("Early post-op recipient (Day 0–3) in bright lighting");

  // Score: reward presence + view coverage; keep conservative (no sharpness heuristics unless available).
  const donorBase = Math.min(30, donorCount * 10);
  const donorBonus = (donorRear ? 7 : 0) + (donorIntraOrDay0 ? 8 : 0);
  const recipientBase = Math.min(30, recipientCount * 10);
  const recipientBonus = (recipientDay0 ? 7 : 0) + (recipientIntra ? 6 : 0) + (recipientEarly ? 7 : 0);
  const claimedBonus = hasClaimed ? 10 : 0;

  const score = clamp(claimedBonus + donorBase + donorBonus + recipientBase + recipientBonus, 0, 100);

  return { score, recommendedMissingPhotos };
}

function adjustEstimateWithEvidenceStrength(params: {
  score: number;
  recommendedMissingPhotos: string[];
  modelOut: Awaited<ReturnType<typeof runGraftIntegrityModelEstimate>>;
}) {
  const s = clamp(Math.round(params.score), 0, 100);

  const widenFactor = s < 60 ? 1.35 : s < 80 ? 1.15 : 1.0;
  const narrowFactor = s >= 85 ? 0.9 : s >= 80 ? 0.95 : 1.0;
  const factor = widenFactor !== 1.0 ? widenFactor : narrowFactor;

  const adjustRange = (r: { min: number | null; max: number | null }) => {
    if (r.min === null || r.max === null) return r;
    const min = Math.max(0, Math.round(r.min));
    const max = Math.max(0, Math.round(r.max));
    const a = Math.min(min, max);
    const b = Math.max(min, max);
    const width = Math.max(0, b - a);
    const center = (a + b) / 2;
    const newW = Math.max(0, Math.round(width * factor));
    const outMin = Math.max(0, Math.round(center - newW / 2));
    const outMax = Math.max(outMin, Math.round(center + newW / 2));
    return { min: outMin, max: outMax };
  };

  const scoreLabel: "low" | "medium" | "high" = s < 60 ? "low" : s < 80 ? "medium" : "high";
  const confidenceScaled = clamp(Number(params.modelOut.confidence) * (0.75 + 0.45 * (s / 100)), 0.45, 0.95);
  const confidence =
    scoreLabel === "low" ? Math.min(confidenceScaled, 0.7) : scoreLabel === "high" ? Math.max(confidenceScaled, 0.7) : confidenceScaled;

  const limitations = Array.isArray(params.modelOut.limitations) ? [...params.modelOut.limitations] : [];
  const flags = Array.isArray(params.modelOut.flags) ? [...params.modelOut.flags] : [];

  if (s < 60) {
    flags.push("low_evidence_strength");
    if (params.recommendedMissingPhotos.length) {
      limitations.push(`Recommended photos to strengthen evidence: ${params.recommendedMissingPhotos.slice(0, 4).join("; ")}`);
    }
  }

  const inputsUsed = {
    ...(params.modelOut.inputs_used as any),
    evidence_sufficiency_score: s,
    recommended_missing_photos: params.recommendedMissingPhotos.slice(0, 8),
  };

  return {
    ...params.modelOut,
    estimated_extracted: adjustRange(params.modelOut.estimated_extracted),
    estimated_implanted: adjustRange(params.modelOut.estimated_implanted),
    confidence,
    confidence_label: scoreLabel,
    limitations,
    flags: Array.from(new Set(flags.map((x) => String(x).trim()).filter(Boolean))),
    inputs_used: inputsUsed as any,
    evidence_sufficiency_score: s,
  };
}

async function upsertGraftIntegrityEstimate(params: {
  supabase: ReturnType<typeof supabaseAdmin>;
  caseId: string;
  claimedGrafts: number | null;
  modelOut: Awaited<ReturnType<typeof runGraftIntegrityModelEstimate>>;
  evidenceSufficiencyScore: number;
  /** When true, if existing row is approved, insert new row instead of overwriting (rerun safety). */
  alwaysInsertIfApproved?: boolean;
}) {
  const { supabase, caseId, claimedGrafts, modelOut, alwaysInsertIfApproved } = params;

  // Prefer server-side computed variance for storage consistency.
  const claimed = claimedGrafts ?? modelOut.claimed_grafts;
  const pct = (est: number | null) => {
    if (!claimed || claimed <= 0 || est === null) return null;
    return ((est - claimed) / claimed) * 100;
  };

  const varianceClaimedVsExtractedMin = pct(modelOut.estimated_extracted.min);
  const varianceClaimedVsExtractedMax = pct(modelOut.estimated_extracted.max);
  const varianceClaimedVsImplantedMin = pct(modelOut.estimated_implanted.min);
  const varianceClaimedVsImplantedMax = pct(modelOut.estimated_implanted.max);

  const { data: existing, error: selErr } = await supabase
    .from("graft_integrity_estimates")
    .select("id, auditor_status")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) throw new Error(`graft_integrity_estimates select failed: ${selErr.message}`);

  // Never overwrite approved GII; insert new row so prior approved remains patient-facing.
  const existingApproved = String((existing as any)?.auditor_status ?? "") === "approved";
  const shouldInsertNew = alwaysInsertIfApproved && existingApproved;

  const payload = {
    case_id: caseId,
    claimed_grafts: claimed,
    estimated_extracted_min: modelOut.estimated_extracted.min,
    estimated_extracted_max: modelOut.estimated_extracted.max,
    estimated_implanted_min: modelOut.estimated_implanted.min,
    estimated_implanted_max: modelOut.estimated_implanted.max,
    variance_claimed_vs_extracted_min_pct: varianceClaimedVsExtractedMin,
    variance_claimed_vs_extracted_max_pct: varianceClaimedVsExtractedMax,
    variance_claimed_vs_implanted_min_pct: varianceClaimedVsImplantedMin,
    variance_claimed_vs_implanted_max_pct: varianceClaimedVsImplantedMax,
    confidence: modelOut.confidence,
    confidence_label: modelOut.confidence_label,
    inputs_used: modelOut.inputs_used,
    limitations: modelOut.limitations,
    flags: modelOut.flags,
    ai_notes: modelOut.ai_notes,
    auditor_status: "pending",
    evidence_sufficiency_score: clamp(Math.round(Number(params.evidenceSufficiencyScore)), 0, 100),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id && !shouldInsertNew) {
    const { error: upErr } = await supabase
      .from("graft_integrity_estimates")
      .update(payload)
      .eq("id", existing.id);
    if (upErr) throw new Error(`graft_integrity_estimates update failed: ${upErr.message}`);
  } else {
    const { error: insErr } = await supabase.from("graft_integrity_estimates").insert(payload);
    if (insErr) throw new Error(`graft_integrity_estimates insert failed: ${insErr.message}`);
  }
}

export const runGraftIntegrityEstimate = inngest.createFunction(
  {
    id: "run-graft-integrity-estimate",
    retries: 2,
    concurrency: { limit: 5 },
  },
  [{ event: "case/submitted" }, { event: "case/graft-integrity-only-requested" }],
  async ({ event, step, logger }) => {
    const data = event.data as { caseId: string; userId?: string; alwaysInsertIfApproved?: boolean };
    const caseId = data.caseId;
    const alwaysInsertIfApproved = Boolean(data.alwaysInsertIfApproved);
    const supabase = supabaseAdmin();

    // 1) Load latest summary for graft count metadata.
    const patientAnswers = await step.run("load-gii-summary", async () => {
      const { data: report, error } = await supabase
        .from("reports")
        .select("id, summary")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`reports load failed: ${error.message}`);
      const summary = (report?.summary ?? {}) as Record<string, unknown>;
      return (summary.patient_answers ?? null) as Record<string, unknown> | null;
    });

    const claimedGrafts = pickClaimedGrafts(patientAnswers);

    const meta: Record<string, string> = {};
    const mdKeys: Array<[string, string]> = [
      ["donor_shaving", String((patientAnswers as any)?.donor_shaving ?? "")],
      ["procedure_type", String((patientAnswers as any)?.procedure_type ?? "")],
      ["surgery_duration", String((patientAnswers as any)?.surgery_duration ?? "")],
    ];
    for (const [k, v] of mdKeys) {
      if (v && v !== "undefined" && v !== "null") meta[k] = v;
    }

    // 2) Reuse the same deterministic evidence preparation pipeline.
    const preparedEvidence = await step.run("prepare-case-evidence", async () => {
      const { manifest } = await prepareCaseEvidenceManifest({
        supabase,
        caseId,
        bucket: BUCKET,
        logger: {
          warn: (message, data) => logger.warn(message, data),
          error: (message, data) => logger.error(message, data),
        },
      });
      return { manifest };
    });

    const preparedImages = preparedEvidence.manifest.prepared_images ?? [];

    const { score: evidenceScore, recommendedMissingPhotos } = classifyEvidenceCoverage({
      claimedGrafts,
      donor: preparedImages
        .filter((img) => String(img.category || "").toLowerCase().includes("donor"))
        .map((img) => ({
          type: `prepared:${img.category}`,
          storage_path: img.prepared_path,
          metadata: { category: img.category, quality_label: img.quality_label },
        })),
      recipient: preparedImages
        .filter((img) => {
          const c = String(img.category || "").toLowerCase();
          return c.includes("recipient") || c.includes("intraop") || c.includes("postop");
        })
        .map((img) => ({
          type: `prepared:${img.category}`,
          storage_path: img.prepared_path,
          metadata: { category: img.category, quality_label: img.quality_label },
        })),
    });

    // 3) Run model + persist. This function is independent of the main audit flow.
    const modelOut = await step.run("run-gii-model", async () => {
      const donorItems = preparedImages
        .filter((img) => String(img.category || "").toLowerCase().includes("donor"))
        .slice(0, 10);
      const recipientItems = preparedImages
        .filter((img) => {
          const c = String(img.category || "").toLowerCase();
          return c.includes("recipient") || c.includes("intraop") || c.includes("postop");
        })
        .slice(0, 10);
      const donorPrepared = await loadPreparedModelImageInputs({ supabase, bucket: BUCKET, items: donorItems });
      const recipientPrepared = await loadPreparedModelImageInputs({ supabase, bucket: BUCKET, items: recipientItems });
      return await runGraftIntegrityModelEstimate({
        claimed_grafts: claimedGrafts,
        donor: donorPrepared.map((img) => ({
          key: img.sourceKey,
          dataUrl: `data:${img.mimeType};base64,${img.dataBase64}`,
        })),
        recipient: recipientPrepared.map((img) => ({
          key: img.sourceKey,
          dataUrl: `data:${img.mimeType};base64,${img.dataBase64}`,
        })),
        metadata: meta,
      });
    });

    const adjusted = adjustEstimateWithEvidenceStrength({
      score: evidenceScore,
      recommendedMissingPhotos,
      modelOut,
    });

    await step.run("persist-gii", async () => {
      await upsertGraftIntegrityEstimate({
        supabase,
        caseId,
        claimedGrafts,
        modelOut: adjusted as any,
        evidenceSufficiencyScore: evidenceScore,
        alwaysInsertIfApproved,
      });
    });

    logger.info("Graft Integrity Estimate saved", {
      caseId,
      claimedGrafts,
      confidence: adjusted.confidence,
      evidenceScore,
      donorImages: preparedImages.filter((img) => String(img.category || "").toLowerCase().includes("donor")).length,
      recipientImages: preparedImages.filter((img) => {
        const c = String(img.category || "").toLowerCase();
        return c.includes("recipient") || c.includes("intraop") || c.includes("postop");
      }).length,
    });

    return { ok: true, caseId };
  }
);

export const runAudit = inngest.createFunction(
  {
    id: "run-audit",
    retries: 3,
    onFailure: async ({ error, event: failureEvent, step }) => {
      const originalEvent = (failureEvent as { data?: { event?: { data?: unknown } } }).data?.event;
      const { caseId, userId } = (originalEvent?.data ?? {}) as { caseId?: string; userId?: string };
      if (!caseId || !userId) {
        console.error("[runAudit onFailure] Missing caseId/userId in event", failureEvent);
        return;
      }

      const supabase = supabaseAdmin();
      const errMsg = error?.message ?? String(error);

      await step.run("mark-audit-failed", async () => {
        await setCasePipelineStatus(supabase, caseId, "failed");
      });

      await step.run("upsert-failed-report", async () => {
        const { data: existing } = await supabase
          .from("reports")
          .select("id, version")
          .eq("case_id", caseId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = (existing?.version ?? 0) + 1;
        if (existing) {
          await supabase
            .from("reports")
            .update({ status: "failed", error: errMsg })
            .eq("id", existing.id);
        } else {
          await supabase.from("reports").insert({
            case_id: caseId,
            version: nextVersion,
            status: "failed",
            error: errMsg,
            pdf_path: "",
            summary: {},
          });
        }
      });

      await step.run("notify-patient", async () => {
        const { data: user } = await supabase.auth.admin.getUserById(userId);
        const email = user?.user?.email;
        if (email) await notifyPatientAuditFailed(caseId, email, errMsg);
      });

      await step.run("notify-auditor", async () => {
        await notifyAuditorAuditFailed(caseId, errMsg);
      });
    },
  },
  [{ event: "case/submitted" }, { event: "case/audit-only-requested" }],
  async ({ event, step, logger }) => {
    const data = event.data as {
      caseId: string;
      userId: string;
      /** Set when `runAudit` is invoked from `auditor/rerun` (not on normal submit). */
      auditorRerunReason?: string | null;
    };
    const caseId = data.caseId;
    const userId = data.userId ?? "";
    const auditorRerunReason = data.auditorRerunReason ?? null;

    const supabase = supabaseAdmin();

    // 1) Load case
    const c = await step.run("load-case", async () => {
      const baseSelect = "id, user_id, patient_id, status, submitted_at, doctor_id, clinic_id, evidence_score_doctor, evidence_score_patient";
      const res = await supabase
        .from("cases")
        .select(baseSelect)
        .eq("id", caseId)
        .maybeSingle();

      // Backward compatibility: if evidence columns don't exist yet, fallback.
      if (res.error && String(res.error.message || "").includes("evidence")) {
        const fb = await supabase
          .from("cases")
          .select("id, user_id, patient_id, status, submitted_at, doctor_id, clinic_id")
          .eq("id", caseId)
          .maybeSingle();
        if (fb.error) throw new Error(`cases load failed: ${fb.error.message}`);
        if (!fb.data) throw new Error("Case not found");
        const actorMatchesFallback =
          fb.data.user_id === userId ||
          fb.data.patient_id === userId ||
          fb.data.doctor_id === userId ||
          fb.data.clinic_id === userId;
        if (!actorMatchesFallback) {
          // Allow reruns when case ownership/assignees changed after original submit event.
          logger.warn("runAudit: event userId no longer linked to case (fallback select); continuing", {
            caseId,
            userId,
            user_id: fb.data.user_id,
            patient_id: fb.data.patient_id,
            doctor_id: fb.data.doctor_id,
            clinic_id: fb.data.clinic_id,
          });
        }
        return fb.data as any;
      }

      if (res.error) throw new Error(`cases load failed: ${res.error.message}`);
      if (!res.data) throw new Error("Case not found");
      const actorMatches =
        res.data.user_id === userId ||
        res.data.patient_id === userId ||
        res.data.doctor_id === userId ||
        res.data.clinic_id === userId;
      if (!actorMatches) {
        logger.warn("runAudit: event userId no longer linked to case; continuing", {
          caseId,
          userId,
          user_id: res.data.user_id,
          patient_id: res.data.patient_id,
          doctor_id: res.data.doctor_id,
          clinic_id: res.data.clinic_id,
        });
      }
      return res.data as any;
    });

    // 2) Notify auditor that a new audit was submitted (so they can log in and complete)
    await step.run("notify-auditor-new-submission", async () => {
      const sent = await notifyAuditorNewAuditSubmitted(caseId);
      logger.info("Auditor new-submission email", { caseId, sent });
      return { sent };
    });

    // 3) Mark processing (optional but helpful)
    await step.run("mark-processing", async () => {
      await setCasePipelineStatus(supabase, caseId, "processing");
    });

    // 4) Verify uploads
    const uploads = await step.run("load-uploads", async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("id, type, storage_path, metadata, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`uploads load failed: ${error.message}`);
      return data ?? [];
    });

    const patientPhotos = uploads.filter((u) => String(u.type ?? "").startsWith("patient_photo:"));
    const patientPhotosForAudit = patientPhotos.filter((u) => !isPatientUploadAuditExcluded(u));
    /** Patient rows marked audit-excluded are omitted everywhere we score or prepare evidence from uploads. */
    const uploadsForEvidenceScoring = uploads.filter(
      (u) => !String(u.type ?? "").startsWith("patient_photo:") || !isPatientUploadAuditExcluded(u)
    );

    const reportRowForPhotoGate = await step.run("load-report-row-for-patient-photo-gate", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("summary, patient_audit_version, patient_audit_v2")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`reports load failed (photo gate): ${error.message}`);
      return data ?? null;
    });

    const patientAnswersForPhotoGate = normalizedPatientAnswersFromReportRow(reportRowForPhotoGate);
    const photoSubmitGate = evaluatePatientPhotoSubmitGate({
      uploadRows: uploads,
      patientAnswers: patientAnswersForPhotoGate,
      stageAwareSubmitEnabled: isPatientPhotoStageAwareSubmitEnabled(),
    });

    const relaxedAuditorPatientPhotoGate =
      auditorRerunReason === AUDITOR_RERUN_REASON_CORRECTED_PATIENT_PHOTOS &&
      patientPhotosForAudit.length > 0;
    if (relaxedAuditorPatientPhotoGate && !photoSubmitGate.allowed) {
      logger.warn("runAudit: strict patient photo submit gate bypassed (auditor corrected patient photos)", {
        caseId,
        viaBaseline: photoSubmitGate.viaBaseline,
        viaAlternateOutcome: photoSubmitGate.viaAlternateOutcome,
        activePatientPhotoCount: patientPhotosForAudit.length,
      });
    }

    if (!photoSubmitGate.allowed && !relaxedAuditorPatientPhotoGate) {
      // Mark case “needs_more_info” or revert to draft
      await step.run("mark-missing", async () => {
        await supabase
          .from("cases")
          .update({ status: "draft" })
          .eq("id", caseId);
      });
      const altHint =
        isPatientPhotoStageAwareSubmitEnabled() && photoSubmitGate.stageAwareEvaluated
          ? ` Or ${PATIENT_ALTERNATE_OUTCOME_SUBMIT_HINT}`
          : "";
      throw new Error(`Missing required patient photos (Current Front, Top, Donor rear).${altHint}`);
    }

    // 5) Load existing report summary (patient/doctor/clinic answers)
    const existingSummary = await step.run("load-report-summary", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, summary, patient_audit_version, patient_audit_v2")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`reports load failed: ${error.message}`);
      const s = (data?.summary ?? {}) as Record<string, unknown>;
      const patientAnswers = normalizedPatientAnswersFromReportRow(
        data as Parameters<typeof normalizedPatientAnswersFromReportRow>[0]
      );
      return {
        patient_answers: patientAnswers,
        doctor_answers: s.doctor_answers ?? null,
        clinic_answers: s.clinic_answers ?? null,
      };
    });

    await step.run("mark-evidence-preparing", async () => {
      await setCasePipelineStatus(supabase, caseId, "evidence_preparing");
    });

    // 5) Deterministic evidence preparation stage (shared by AI audit + graft integrity + PDF).
    const preparedVision = await step.run("prepare-case-evidence", async () => {
      const { manifest } = await prepareCaseEvidenceManifest({
        supabase,
        caseId,
        bucket: BUCKET,
        uploads: uploads as {
          id: string;
          type?: string | null;
          storage_path?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string | null;
        }[],
        logger: {
          warn: (message, data) => logger.warn(message, data),
          error: (message, data) => logger.error(message, data),
        },
      });
      return { manifest };
    });
    const imageIngestionStats = {
      manifest_id: preparedVision.manifest.id,
      status: preparedVision.manifest.status,
      selected_count: uploads.filter((u) => {
        if (!isImageUpload(String(u.type ?? ""))) return false;
        if (String(u.type ?? "").startsWith("patient_photo:") && isPatientUploadAuditExcluded(u)) return false;
        return true;
      }).length,
      prepared_count: preparedVision.manifest.prepared_images.length,
      failed_count: (preparedVision.manifest.errors ?? []).length,
      quality_score: Number(preparedVision.manifest.quality_score ?? 0),
      missing_categories: preparedVision.manifest.missing_categories ?? [],
      errors: preparedVision.manifest.errors ?? [],
      prepared_category_counts: Object.values(
        (preparedVision.manifest.prepared_images ?? []).reduce(
          (acc, item) => {
            const key = String(item.category || "uncategorized");
            const entry = acc[key] ?? { category: key, count: 0 };
            entry.count += 1;
            acc[key] = entry;
            return acc;
          },
          {} as Record<string, { category: string; count: number }>
        )
      ),
      generated_at: preparedVision.manifest.updated_at ?? new Date().toISOString(),
    };

    await step.run("mark-evidence-ready", async () => {
      await setCasePipelineStatus(supabase, caseId, "evidence_ready");
    });

    // Detect patient-only audit: no doctor/clinic answers and no doctor photos
    const doctorPhotos = uploads.filter((u) => String(u.type ?? "").startsWith("doctor_photo:"));
    const hasDoctorAnswers = existingSummary.doctor_answers && typeof existingSummary.doctor_answers === "object" && Object.keys(existingSummary.doctor_answers as object).length > 0;
    const hasClinicAnswers = existingSummary.clinic_answers && typeof existingSummary.clinic_answers === "object" && Object.keys(existingSummary.clinic_answers as object).length > 0;
    const aiAuditMode: "patient" | "full" =
      doctorPhotos.length > 0 || hasDoctorAnswers || hasClinicAnswers ? "full" : "patient";
    const pdfAuditMode: AuditMode =
      aiAuditMode === "patient"
        ? "patient"
        : (hasDoctorAnswers || doctorPhotos.length > 0) && hasClinicAnswers
          ? "auditor"
          : hasDoctorAnswers || doctorPhotos.length > 0
            ? "doctor"
            : hasClinicAnswers
              ? "clinic"
              : "patient";

    await step.run("mark-audit-running", async () => {
      await setCasePipelineStatus(supabase, caseId, "audit_running");
    });

    // 6) Run AI audit (answers + prepared evidence images)
    const aiResult = await step.run("run-ai-audit", async () => {
      const patientAnswers = existingSummary.patient_answers as Record<string, unknown> | null;
      const enhanced =
        patientAnswers && typeof patientAnswers === "object"
          ? ((patientAnswers as Record<string, unknown>).enhanced_patient_answers as Record<string, unknown> | null | undefined)
          : null;

      // Baseline may be provided either as a top-level baseline object or inside enhanced answers.
      const baseline =
        patientAnswers && typeof patientAnswers === "object"
          ? (((patientAnswers as Record<string, unknown>).patient_baseline ??
              (enhanced && typeof enhanced === "object" ? (enhanced as any).baseline : null)) as Record<string, unknown> | null | undefined)
          : null;

      const aiExtendedEvidence = isAiExtendedImageEvidenceEnabled();
      const manifestPrepared = (preparedVision.manifest.prepared_images ?? []) as PreparedImageManifestItem[];
      const modelInputs = await loadPreparedModelImageInputs({
        supabase,
        bucket: BUCKET,
        items: manifestPrepared,
        maxItems: 10,
        caseId,
        logger: {
          info: (msg, data) => logger.info(msg, data ?? {}),
          warn: (msg, data) => logger.warn(msg, data ?? {}),
        },
      });
      const patientImageEvidenceGroups = buildPatientImageEvidenceGroups({
        enabled: aiExtendedEvidence,
        uploads: uploads as {
          id?: string | null;
          type?: string | null;
          storage_path?: string | null;
          metadata?: Record<string, unknown> | null;
        }[],
        preparedImages: manifestPrepared,
      });
      const patientImageEvidenceConfidence = buildPatientImageEvidenceConfidence(patientImageEvidenceGroups);

      return await runAIAudit({
        patient_answers: patientAnswers,
        doctor_answers: existingSummary.doctor_answers as Record<string, unknown> | null,
        clinic_answers: existingSummary.clinic_answers as Record<string, unknown> | null,
        enhanced_patient_answers: (enhanced as any) ?? null,
        patient_baseline: (baseline as any) ?? null,
        imageInputs: modelInputs.map((img) => ({
          sourceKey: img.sourceKey,
          mimeType: img.mimeType,
          dataBase64: img.dataBase64,
        })),
        failedImageKeys: (preparedVision.manifest.errors ?? []).map((e) => String(e).split(":")[0] ?? String(e)),
        requestedImageCount: imageIngestionStats.selected_count,
        auditMode: aiAuditMode,
        ...(aiExtendedEvidence ? { patientImageEvidenceGroups, patientImageEvidenceConfidence } : {}),
      });
    });

    const aiAuditFailureReason = (() => {
      const model = String((aiResult as any)?.model ?? "").toLowerCase();
      const summaryText = String((aiResult as any)?.summary ?? "");
      const notesText = String((aiResult as any)?.notes ?? "");
      const limitations = Array.isArray((aiResult as any)?.data_quality?.limitations)
        ? ((aiResult as any).data_quality.limitations as unknown[]).map((x) => String(x))
        : [];
      const failureLine =
        limitations.find((x) => /ai audit failed:/i.test(x)) ||
        [summaryText, notesText].find((x) => /ai audit failed:/i.test(x));
      if (model === "error") return failureLine || "AI audit failed: model returned error";
      if (failureLine) return failureLine;
      return null;
    })();

    if (aiAuditFailureReason) {
      const failedVersion = await step.run("next-version-audit-failed", async () => {
        const { data, error } = await supabase
          .from("reports")
          .select("version")
          .eq("case_id", caseId)
          .order("version", { ascending: false })
          .limit(1);

        if (error) throw new Error(`reports load failed: ${error.message}`);
        const latest = data?.[0]?.version ?? 0;
        return Number(latest) + 1;
      });

      await step.run("insert-audit-failed-report", async () => {
        const { error } = await supabase.from("reports").insert({
          case_id: caseId,
          version: failedVersion,
          pdf_path: "",
          auditor_review_eligibility: "not_eligible",
          auditor_review_status: "not_requested",
          auditor_review_reason: null,
          provisional_status: "none",
          counts_for_awards: false,
          summary: {
            ...existingSummary,
            image_ingestion_stats: imageIngestionStats,
            score: 0,
            donor_quality: "Cannot assess",
            graft_survival_estimate: "Unknown",
            notes: String(aiAuditFailureReason),
            findings: [],
            forensic_audit: {
              auditMode: pdfAuditMode,
              overall_score: 0,
              confidence: 0.45,
              confidence_label: "low",
              data_quality: aiResult.data_quality,
              section_scores: aiResult.section_scores,
              key_findings: aiResult.key_findings,
              red_flags: aiResult.red_flags,
              photo_observations: aiResult.photo_observations,
              summary: aiResult.summary,
              non_medical_disclaimer: aiResult.non_medical_disclaimer,
              model: aiResult.model,
            },
          },
          status: "failed",
          error: String(aiAuditFailureReason),
        });
        if (error) throw new Error(`reports insert failed: ${error.message}`);
      });

      await step.run("mark-audit-failed-phase", async () => {
        await setReportPipelineStatus(supabase, caseId, failedVersion, "audit_failed", {
          error: String(aiAuditFailureReason),
          pdf_path: "",
        });
        await setCasePipelineStatus(supabase, caseId, "audit_failed");
      });

      logger.warn("Audit failed before PDF generation", {
        caseId,
        version: failedVersion,
        reason: aiAuditFailureReason,
      });
      return { ok: false, version: failedVersion, status: "audit_failed" as const };
    }

    // 6a) Doctor scoring narrative (GPT; non-blocking) only for non-patient audits.
    const scoringNarrative =
      aiAuditMode === "patient"
        ? null
        : await step.run("doctor-scoring-narrative", async () => {
            try {
              const doctorAnswers = existingSummary.doctor_answers as Record<string, unknown> | null;

              const ctx = computeDoctorAiContextV1({
                uploads: uploadsForEvidenceScoring as any,
                doctorAnswersRaw: (doctorAnswers as any) ?? null,
                doctorId: (c as any)?.doctor_id ?? null,
                clinicId: (c as any)?.clinic_id ?? null,
              });

              const missingRequired: string[] = [];
              const per = (ctx.completeness_index_v1 as any)?.breakdown?.photo_coverage?.per_category ?? {};
              for (const [k, v] of Object.entries(per)) {
                if (Number((v as any)?.done ?? 0) < 1) missingRequired.push(`doctor_photo:${String(k)}`);
              }
              const missingStructured = (ctx.completeness_index_v1 as any)?.breakdown?.structured_metadata?.missing_keys ?? [];
              for (const k of (Array.isArray(missingStructured) ? missingStructured : []).slice(0, 15)) {
                missingRequired.push(`doctor_answers:${String(k)}`);
              }

              const imageFindingsSummary =
                `data_quality.limitations: ${(aiResult as any)?.data_quality?.limitations?.slice?.(0, 8)?.join?.("; ") ?? "(none)"}\n` +
                `key_findings: ${((aiResult as any)?.key_findings ?? []).slice(0, 5).map((x: any) => String(x?.title ?? "")).filter(Boolean).join("; ") || "(none)"}\n` +
                `red_flags: ${((aiResult as any)?.red_flags ?? []).slice(0, 5).map((x: any) => String(x?.title ?? "")).filter(Boolean).join("; ") || "(none)"}`;

              const out = await runDoctorScoringNarrative({
                doctor_answers: doctorAnswers,
                ai_context: { ...(ctx.ai_context as any), missing_required: missingRequired.slice(0, 30) },
                ai_audit_result: aiResult as any,
                image_findings_summary: imageFindingsSummary,
                protocolCatalog: DEFAULT_PROTOCOL_CATALOG,
                trainingModuleCatalog: DEFAULT_TRAINING_MODULE_CATALOG,
              });

              return { narrative: out.narrative, model: out.model, generated_at: new Date().toISOString() };
            } catch (err: any) {
              console.error("doctor-scoring-narrative failed", {
                caseId,
                message: String(err?.message ?? err),
              });
              return null;
            }
          });

    // 6b) Evidence-weighted v1 domains (deterministic; confidence-gated)
    const v1 = await step.run("compute-v1-domains", async () => {
      return computeDomainScoresV1({
        ai: aiResult as any,
        uploads: uploadsForEvidenceScoring as any,
        caseRow: {
          evidence_score_doctor: (c as any)?.evidence_score_doctor ?? null,
          evidence_score_patient: (c as any)?.evidence_score_patient ?? null,
          doctor_id: (c as any)?.doctor_id ?? null,
          clinic_id: (c as any)?.clinic_id ?? null,
        },
        doctorAnswersRaw: (existingSummary.doctor_answers as any) ?? null,
        auditMode: aiAuditMode,
      });
    });

    // 7) Determine report version
    const nextVersion = await step.run("next-version", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("version")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);

      if (error) throw new Error(`reports load failed: ${error.message}`);
      const latest = data?.[0]?.version ?? 0;
      return Number(latest) + 1;
    });

    // 8) Build + upload PDF via separate API (avoids bundling reportBuilder/canvas into api/inngest → Vercel 300MB limit)
    const pdfPath = `${caseId}/v${nextVersion}.pdf`;

    const graftIntegrity = await step.run("load-graft-integrity", async () => {
      const { data } = await supabase
        .from("graft_integrity_estimates")
        .select(
          "claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, confidence, confidence_label, limitations, auditor_status"
        )
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const status = String((data as any)?.auditor_status ?? "pending") as any;
      return {
        auditor_status: status,
        claimed_grafts: (data as any)?.claimed_grafts ?? null,
        estimated_extracted: { min: (data as any)?.estimated_extracted_min ?? null, max: (data as any)?.estimated_extracted_max ?? null },
        estimated_implanted: { min: (data as any)?.estimated_implanted_min ?? null, max: (data as any)?.estimated_implanted_max ?? null },
        variance_claimed_vs_implanted_pct: {
          min: (data as any)?.variance_claimed_vs_implanted_min_pct ?? null,
          max: (data as any)?.variance_claimed_vs_implanted_max_pct ?? null,
        },
        confidence: Number((data as any)?.confidence ?? 0.45),
        confidence_label: String((data as any)?.confidence_label ?? "medium"),
        limitations: Array.isArray((data as any)?.limitations) ? (data as any).limitations : [],
      };
    });

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const photoCount = uploads.length;
    const missingCategories = aiResult.data_quality?.missing_photos ?? [];
    const missingCount = Array.isArray(missingCategories) ? missingCategories.length : 0;
    const obs = Array.isArray(aiResult.photo_observations) ? aiResult.photo_observations : [];
    const totalViews = obs.length || (preparedVision.manifest.prepared_images ?? []).length || 0;
    const knownViews = obs.filter((p: any) => String(p?.suspected_view ?? "") && String(p?.suspected_view ?? "") !== "unknown").length;
    const viewSuccessRate = totalViews > 0 ? knownViews / totalViews : 0;
    const deriveConfidence = () => {
      const photoFactor = clamp(photoCount / 6, 0, 1);
      const viewFactor = clamp(viewSuccessRate, 0, 1);
      const missingPenalty = clamp(missingCount / 6, 0, 1) * 0.25;
      return clamp(0.45 + 0.35 * photoFactor + 0.25 * viewFactor - missingPenalty, 0.45, 0.92);
    };
    const confForReport = Number.isFinite(Number(aiResult.confidence)) && Number(aiResult.confidence) > 0 ? Number(aiResult.confidence) : deriveConfidence();
    const confLabelForReport = confForReport < 0.55 ? "low" : confForReport < 0.8 ? "medium" : "high";

    // 10) Insert report row (with AI audit + answers)
    await step.run("insert-report-row", async () => {
      const doctorAnswersBase =
        existingSummary.doctor_answers && typeof existingSummary.doctor_answers === "object"
          ? ({ ...(existingSummary.doctor_answers as Record<string, unknown>) } as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const tiers = ((v1 as any)?.tiers_v1 ?? []) as Array<{ tier_id?: string; eligible?: boolean }>;
      const tier: 1 | 2 | 3 | undefined = tiers.find((t) => t?.tier_id === "tier3_award")?.eligible
        ? 3
        : tiers.find((t) => t?.tier_id === "tier2_certified")?.eligible
          ? 2
          : tiers.find((t) => t?.tier_id === "tier1_standard")?.eligible
            ? 1
            : undefined;

      const completeness = (v1 as any)?.completeness_index_v1;
      const confidenceModel = (v1 as any)?.confidence_model_v1;
      const benchmark = (v1 as any)?.benchmark;
      const overall = (v1 as any)?.overall_scores_v1;
      const domains = (((v1 as any)?.domains ?? []) as any[]).filter(Boolean);

      if (aiAuditMode !== "patient") {
        // Persist computed AI context under doctor_answers (minimal/safe namespace).
        (doctorAnswersBase as any).ai_context = {
          completeness_score: Number(completeness?.score ?? 0),
          completeness_breakdown: {
            photos: Number(completeness?.breakdown?.photo_coverage?.score ?? 0),
            structured: Number(completeness?.breakdown?.structured_metadata?.score ?? 0),
            numeric: Number(completeness?.breakdown?.numeric_precision?.score ?? 0),
            verification: Number(completeness?.breakdown?.verification_evidence?.score ?? 0),
          },
          evidence_grade: String(confidenceModel?.evidence_grade ?? "D"),
          confidence_multiplier: Number(confidenceModel?.confidence_multiplier ?? 0.5),
          benchmark_eligible: Boolean(benchmark?.eligible ?? false),
          tier,
        };

        // Persist scoring snapshot under doctor_answers.scoring (v1 deterministic today; can be GPT/hybrid later).
        const domainsRecord: Record<string, any> = {};
        const protocolOps: any[] = [];
        const suggestedModules: any[] = [];
        for (const d of domains) {
          const domainId = String(d?.domain_id ?? "");
          if (!domainId) continue;
          domainsRecord[domainId] = {
            raw_score: Number(d?.raw_score ?? 0),
            confidence: Number(d?.confidence ?? 0.5),
            evidence_grade: String(d?.evidence_grade ?? "D"),
            weighted_score: Number(d?.weighted_score ?? 0),
            drivers: Array.isArray(d?.drivers) ? d.drivers : [],
            limiters: Array.isArray(d?.limiters) ? d.limiters : [],
            priority_actions: Array.isArray(d?.priority_actions)
              ? d.priority_actions.map((a: any) => ({
                  action: String(a?.action ?? ""),
                  impact: a?.impact,
                  effort: a?.effort,
                  evidence_needed: Array.isArray(a?.evidence_needed) ? a.evidence_needed : undefined,
                }))
              : [],
          };
          if (Array.isArray(d?.protocol_opportunities)) protocolOps.push(...d.protocol_opportunities);
          if (Array.isArray(d?.suggested_modules)) suggestedModules.push(...d.suggested_modules);
        }

        const uniqBy = <T,>(items: T[], key: (t: T) => string) => {
          const out: T[] = [];
          const seen = new Set<string>();
          for (const it of items) {
            const k = key(it);
            if (!k || seen.has(k)) continue;
            seen.add(k);
            out.push(it);
          }
          return out;
        };

        // If GPT narrative exists, merge WHITELISTED narrative fields only (numbers remain deterministic).
        const narrative = (scoringNarrative as any)?.narrative ?? null;
        const narrativeDomains = narrative?.domains ?? null;
        if (narrativeDomains && typeof narrativeDomains === "object") {
          for (const key of ["SP", "DP", "GV", "IC", "DI"]) {
            if (!domainsRecord[key]) continue;
            const nd = (narrativeDomains as any)[key];
            if (!nd || typeof nd !== "object") continue;
            if (Array.isArray(nd.drivers)) domainsRecord[key].drivers = nd.drivers;
            if (Array.isArray(nd.limiters)) domainsRecord[key].limiters = nd.limiters;
            if (Array.isArray(nd.priority_actions)) domainsRecord[key].priority_actions = nd.priority_actions;
          }
        }

        const narrativeProtocols = narrative?.protocol_opportunities;
        const narrativeModules = narrative?.suggested_modules;
        const narrativeMissingEvidence = narrative?.missing_evidence_priorities;

        (doctorAnswersBase as any).scoring = {
          domains: domainsRecord,
          overall: {
            raw_score: Number(overall?.performance_score ?? 0),
            confidence: Number(overall?.confidence_multiplier ?? 0.5),
            evidence_grade: String(overall?.confidence_grade ?? "D"),
            weighted_score: Number(overall?.benchmark_score ?? 0),
          },
          protocol_opportunities: Array.isArray(narrativeProtocols)
            ? narrativeProtocols
            : uniqBy(protocolOps, (x: any) => String(x?.name ?? "")).slice(0, 25),
          suggested_modules: Array.isArray(narrativeModules)
            ? narrativeModules
            : uniqBy(suggestedModules, (x: any) => String(x?.module_id ?? ""))?.slice(0, 25),
          missing_evidence_priorities: Array.isArray(narrativeMissingEvidence) ? narrativeMissingEvidence : undefined,
        };

        if (scoringNarrative && (scoringNarrative as any)?.generated_at) {
          (doctorAnswersBase as any).scoring_generated_at = String((scoringNarrative as any).generated_at);
        }
        if (scoringNarrative && (scoringNarrative as any)?.narrative) {
          (doctorAnswersBase as any).scoring_version = "v2";
        }
      } else {
        // Ensure patient-only reports don't carry doctor scoring artifacts.
        delete (doctorAnswersBase as any).ai_context;
        delete (doctorAnswersBase as any).scoring;
        delete (doctorAnswersBase as any).scoring_generated_at;
        delete (doctorAnswersBase as any).scoring_version;
      }

      const summary = {
        ...existingSummary,
        image_ingestion_stats: imageIngestionStats,
        doctor_answers: doctorAnswersBase,
        score: aiResult.score,
        donor_quality: aiResult.donor_quality,
        graft_survival_estimate: aiResult.graft_survival_estimate,
        notes: aiResult.notes,
        findings: aiResult.findings,
        // Store the full forensic audit payload for downstream UI + analytics
        forensic_audit: {
          auditMode: pdfAuditMode,
          overall_score: aiResult.overall_score,
          confidence: confForReport,
          confidence_label: confLabelForReport,
          data_quality: {
            ...aiResult.data_quality,
            limitations:
              aiAuditMode === "patient"
                ? (aiResult.data_quality?.limitations ?? []).filter(
                    (l) =>
                      !/doctor|clinic|doctor_answers|clinic_answers/i.test(
                        String(l)
                      )
                  )
                : aiResult.data_quality?.limitations,
          },
          section_scores: aiResult.section_scores,
          key_findings: aiResult.key_findings,
          red_flags: aiResult.red_flags,
          photo_observations: aiResult.photo_observations,
          summary: aiResult.summary,
          non_medical_disclaimer: aiResult.non_medical_disclaimer,
          model: aiResult.model,
          domain_scores_v1: {
            version: 1,
            domains: (v1 as any)?.domains ?? [],
          },
          benchmark: (v1 as any)?.benchmark ?? { eligible: false, gate_version: "balanced_v1", reasons: ["Benchmark computation unavailable."] },
          completeness_index_v1: (v1 as any)?.completeness_index_v1 ?? { version: 1, score: 0, weights: { photos: 45, structured_metadata: 35, numeric_precision: 10, verification_evidence: 10 }, breakdown: {} },
          confidence_model_v1: (v1 as any)?.confidence_model_v1 ?? undefined,
          overall_scores_v1: (v1 as any)?.overall_scores_v1 ?? undefined,
          tiers_v1: (v1 as any)?.tiers_v1 ?? undefined,
        },
        area_scores: null,
        section_scores: aiResult.section_scores,
        ai_audit: {
          model: aiResult.model,
          generated_at: new Date().toISOString(),
          image_ingestion_stats: imageIngestionStats,
        },
      };

      const finalAiScore = Number(overall?.performance_score ?? overall?.benchmark_score ?? 0);
      const { eligibility: auditorReviewEligibility, status: auditorReviewStatus, reason: auditorReviewReason } = computeAuditorReviewEligibility(finalAiScore);
      const { provisional_status: provisionalStatus, counts_for_awards: countsForAwards } = computeProvisionalFromScore(finalAiScore);
      const benchmarkEligible = Boolean((v1 as any)?.benchmark?.eligible);
      const awardContributionWeight = computeAwardContributionWeight({
        score: finalAiScore,
        provisionalStatus,
        countsForAwards,
        benchmarkEligible,
      });

      const { error } = await supabase.from("reports").insert({
        case_id: caseId,
        version: nextVersion,
        pdf_path: pdfPath,
        summary,
        status: "processing",
        error: null,
        auditor_review_eligibility: auditorReviewEligibility,
        auditor_review_status: auditorReviewStatus,
        auditor_review_reason: auditorReviewReason,
        provisional_status: provisionalStatus,
        counts_for_awards: countsForAwards,
        award_contribution_weight: awardContributionWeight,
      });

      if (error) throw new Error(`reports insert failed: ${error.message}`);
    });

    // 11) Mark audit completion phase before PDF phase.
    await step.run("mark-audit-complete-phase", async () => {
      await setReportPipelineStatus(supabase, caseId, nextVersion, "audit_complete", { error: null });
      await setCasePipelineStatus(supabase, caseId, "audit_complete");
    });

    // 12) PDF phase with readiness-aware retry/skip.
    await step.run("mark-pdf-pending-phase", async () => {
      await setReportPipelineStatus(supabase, caseId, nextVersion, "pdf_pending", { error: null });
      await setCasePipelineStatus(supabase, caseId, "pdf_pending");
    });

    let finalPdfPath: string | null = null;
    const maxPdfAttempts = 3;
    for (let attempt = 1; attempt <= maxPdfAttempts; attempt += 1) {
      const readiness = await step.run(`pdf-readiness-check-${attempt}`, async () => {
        const [{ data: caseRow }, { data: reportRow }] = await Promise.all([
          supabase.from("cases").select("status").eq("id", caseId).maybeSingle(),
          supabase
            .from("reports")
            .select("status, summary")
            .eq("case_id", caseId)
            .eq("version", nextVersion)
            .maybeSingle(),
        ]);
        const state = shouldGeneratePdf({
          caseStatus: (caseRow as { status?: string | null } | null)?.status ?? null,
          reportStatus: (reportRow as { status?: string | null } | null)?.status ?? null,
          summary: (reportRow as { summary?: unknown } | null)?.summary ?? null,
        });
        logger.info("PDF readiness check", {
          caseId,
          attempt,
          caseStatus: (caseRow as { status?: string | null } | null)?.status ?? null,
          reportStatus: (reportRow as { status?: string | null } | null)?.status ?? null,
          ready: state.ready,
          reason: state.reason ?? null,
        });
        return state;
      });

      if (!readiness.ready) {
        const msg = `AUDIT_NOT_READY: ${String(readiness.reason ?? "preconditions not met")}`;
        await step.run(`pdf-readiness-pending-${attempt}`, async () => {
          await setReportPipelineStatus(supabase, caseId, nextVersion, "pdf_pending", { error: msg });
        });
        if (attempt < maxPdfAttempts) {
          logger.warn("PDF step skipped this attempt due to readiness", { caseId, attempt, reason: readiness.reason });
          await step.sleep(`wait-for-pdf-readiness-${attempt}`, "20s");
          continue;
        }
        logger.warn("PDF phase deferred after max readiness attempts", { caseId, attempts: maxPdfAttempts });
        break;
      }

      try {
        const result = await step.run(`build-and-upload-pdf-${attempt}`, async () => {
          return await renderAndUploadPdfForCase({
            caseId,
            auditMode: pdfAuditMode,
            version: nextVersion,
          });
        });
        finalPdfPath = String(result.pdfPath ?? pdfPath);
        break;
      } catch (e: any) {
        const code = String(e?.code ?? "");
        const msg = String(e?.message ?? e);
        if (code === "AUDIT_NOT_READY" || /AUDIT_NOT_READY/i.test(msg)) {
          await step.run(`mark-pdf-pending-after-not-ready-${attempt}`, async () => {
            await setReportPipelineStatus(supabase, caseId, nextVersion, "pdf_pending", { error: msg });
          });
          logger.warn("PDF generation returned AUDIT_NOT_READY", { caseId, attempt, message: msg });
          if (attempt < maxPdfAttempts) {
            await step.sleep(`wait-after-audit-not-ready-${attempt}`, "20s");
            continue;
          }
          break;
        }
        await step.run(`mark-pdf-failed-${attempt}`, async () => {
          await setReportPipelineStatus(supabase, caseId, nextVersion, "failed", { error: msg });
          await setCasePipelineStatus(supabase, caseId, "failed");
        });
        throw e;
      }
    }

    if (!finalPdfPath) {
      logger.info("Audit pipeline completed with PDF pending", { caseId, nextVersion });
      return { ok: true, version: nextVersion, pdfPath: null, pdfStatus: "pending" as const };
    }

    // 13) Finalize PDF-ready phase.
    await step.run("finalize-pdf-ready-phase", async () => {
      await setReportPipelineStatus(supabase, caseId, nextVersion, "pdf_ready", {
        pdf_path: finalPdfPath,
        error: null,
      });
      await setCasePipelineStatus(supabase, caseId, "pdf_ready");
      // Keep legacy-compatible terminal state for dashboards that key off "complete".
      await supabase.from("cases").update({ status: "complete" }).eq("id", caseId);
    });

    await step.run("refresh-transparency-metrics", async () => {
      const result = await refreshTransparencyMetricsForCase(supabase, caseId, {
        reason: "report_complete",
        log: (msg, meta) => logger.info(msg, meta ?? {}),
      });
      logger.info("Transparency refresh after report complete", { caseId, ...result });
      return result;
    });

    // 14) Notify patient that report is ready (idempotent: only send once per report).
    await step.run("notify-patient-report-ready", async () => {
      const res = await supabase
        .from("reports")
        .update({ report_ready_email_sent_at: new Date().toISOString() })
        .eq("case_id", caseId)
        .eq("version", nextVersion)
        .is("report_ready_email_sent_at", null)
        .select("id")
        .maybeSingle();

      if (res.error) {
        const msg = String(res.error.message ?? "");
        if (/report_ready_email_sent_at|column.*does not exist/i.test(msg)) {
          logger.info("Report-ready email skipped (idempotency column missing)", { caseId, nextVersion });
          return { sent: false, reason: "skip" };
        }
        throw new Error(res.error.message);
      }

      if (!res.data) {
        logger.info("Report-ready email skipped (already sent)", { caseId, nextVersion });
        return { sent: false, reason: "already_sent" };
      }

      const { data: user } = await supabase.auth.admin.getUserById(userId);
      const email = user?.user?.email;
      if (!email || typeof email !== "string" || !email.trim()) {
        logger.info("Report-ready email skipped: no patient email", { caseId });
        return { sent: false, reason: "no_email" };
      }

      const firstName =
        (user?.user?.user_metadata as Record<string, unknown> | undefined)?.first_name ??
        (user?.user?.user_metadata as Record<string, unknown> | undefined)?.name;
      const sent = await notifyPatientReportReady({
        to: email.trim(),
        caseId,
        firstName: firstName != null ? String(firstName).trim() || null : null,
      });
      logger.info("Report-ready email sent", { caseId, sent });
      return { sent, reason: sent ? "sent" : "send_failed" };
    });

    logger.info("Audit pipeline complete", { caseId, nextVersion, pdfPath: finalPdfPath });
    return { ok: true, version: nextVersion, pdfPath: finalPdfPath, pdfStatus: "ready" as const };
  }
);

export const runPdfRebuild = inngest.createFunction(
  {
    id: "run-pdf-rebuild",
    retries: 2,
    concurrency: { limit: 5 },
  },
  { event: "case/pdf-rebuild-requested" },
  async ({ event, step, logger }) => {
    const { caseId } = event.data as { caseId: string };
    const supabase = supabaseAdmin();

    const { data: latest } = await supabase
      .from("reports")
      .select("version, status")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestStatus = String((latest as any)?.status ?? "");
    if (!latest || (latestStatus !== "complete" && latestStatus !== "pdf_ready")) {
      throw new Error(`No complete report found for case ${caseId}`);
    }
    const version = Number((latest as any)?.version ?? 0);
    if (version < 1) throw new Error(`Invalid report version for case ${caseId}`);

    const result = await step.run("rebuild-pdf", async () => {
      return await renderAndUploadPdfForCase({
        caseId,
        version,
      });
    });

    logger.info("PDF rebuild complete", { caseId, version });
    return { ok: true, version, pdfPath: result?.pdfPath };
  }
);

export const auditorRerun = inngest.createFunction(
  {
    id: "auditor-rerun",
    retries: 0,
    concurrency: { limit: 5 },
  },
  { event: "auditor/rerun" },
  async ({ event, step, logger }) => {
    const data = event.data as {
      caseId: string;
      action: string;
      reason: string;
      notes: string | null;
      triggeredBy: string;
      triggeredRole: string;
      rerunLogId: string | null;
      sourceReportVersion: number | null;
    };

    const { caseId, action, rerunLogId, triggeredBy, sourceReportVersion } = data;
    const supabase = supabaseAdmin();

    await step.run("mark-processing", async () => {
      if (rerunLogId) {
        await supabase
          .from("audit_rerun_log")
          .update({ status: "processing" })
          .eq("id", rerunLogId);
      }
    });

    const complete = async (status: "complete" | "failed", targetVersion?: number | null, err?: string) => {
      if (rerunLogId) {
        await supabase
          .from("audit_rerun_log")
          .update({
            status,
            target_report_version: targetVersion ?? null,
            error: err ?? null,
          })
          .eq("id", rerunLogId);
      }
    };

    try {
      switch (action) {
        case "regenerate_ai_audit": {
          const result = await step.invoke("invoke-audit", {
            function: runAudit,
            data: { caseId, userId: triggeredBy, auditorRerunReason: data.reason },
          });
          const ver = (result as any)?.version;
          const sourceReportVersion = data.sourceReportVersion != null ? Number(data.sourceReportVersion) : null;
          if (typeof ver === "number" && ver >= 1 && typeof sourceReportVersion === "number" && sourceReportVersion >= 1) {
            await step.run("copy-auditor-overrides-to-new-report", async () => {
              const sb = supabaseAdmin();
              const [sourceRes, newRes] = await Promise.all([
                sb.from("reports").select("id").eq("case_id", caseId).eq("version", sourceReportVersion).maybeSingle(),
                sb.from("reports").select("id, summary").eq("case_id", caseId).eq("version", ver).maybeSingle(),
              ]);
              const sourceReportId = (sourceRes.data as { id?: string } | null)?.id ?? null;
              const newReport = newRes.data as { id: string; summary: Record<string, unknown> | null } | null;
              const newReportId = newReport?.id ?? null;
              if (!sourceReportId || !newReportId) {
                logger.info("Copy overrides skipped: source or new report not found", {
                  caseId,
                  sourceReportVersion,
                  ver,
                  hasSource: !!sourceReportId,
                  hasNew: !!newReportId,
                });
                return { copiedOverrides: 0, copiedFeedback: 0 };
              }
              const summary = (newReport?.summary ?? {}) as Record<string, unknown>;
              const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
              const domainScores = forensic?.domain_scores_v1 as { domains?: Array<{ domain_id?: string; raw_score?: number; weighted_score?: number }> } | undefined;
              const domains = Array.isArray(domainScores?.domains) ? domainScores.domains : [];
              const newAiByDomain = new Map<string, { raw: number; weighted: number | null }>();
              for (const d of domains) {
                const id = String(d.domain_id ?? "");
                if (!id) continue;
                newAiByDomain.set(id, {
                  raw: Number(d.raw_score ?? 0),
                  weighted: d.weighted_score != null ? Number(d.weighted_score) : null,
                });
              }
              const { data: overrides } = await sb
                .from("audit_score_overrides")
                .select("*")
                .eq("report_id", sourceReportId);
              const rows = (overrides ?? []) as Array<{
                domain_key: string;
                manual_score: number;
                manual_weighted_score: number | null;
                reason_category: string;
                override_note: string | null;
                visibility_scope?: string;
                created_by: string | null;
                section_key?: string | null;
              }>;
              let copiedOverrides = 0;
              for (const row of rows) {
                const newAi = newAiByDomain.get(row.domain_key) ?? { raw: 0, weighted: null };
                const aiScore = newAi.raw;
                const aiWeightedScore = newAi.weighted;
                const manualScore = Number(row.manual_score);
                const deltaScore = Number((manualScore - aiScore).toFixed(2));
                const manualWeightedScore = row.manual_weighted_score != null ? Number(row.manual_weighted_score) : null;
                const { error: insErr } = await sb.from("audit_score_overrides").upsert(
                  {
                    case_id: caseId,
                    report_id: newReportId,
                    domain_key: row.domain_key,
                    section_key: row.section_key ?? null,
                    ai_score: aiScore,
                    ai_weighted_score: aiWeightedScore,
                    manual_score: manualScore,
                    manual_weighted_score: manualWeightedScore,
                    delta_score: deltaScore,
                    reason_category: row.reason_category,
                    override_note: row.override_note,
                    visibility_scope: row.visibility_scope ?? "internal_only",
                    created_by: row.created_by,
                  },
                  { onConflict: "case_id,report_id,domain_key" }
                );
                if (!insErr) copiedOverrides += 1;
              }
              const { data: sectionFeedback } = await sb
                .from("audit_section_feedback")
                .select("section_key, feedback_type, visibility_scope, feedback_note, created_by")
                .eq("report_id", sourceReportId);
              const feedbackRows = (sectionFeedback ?? []) as Array<{
                section_key: string;
                feedback_type: string;
                visibility_scope: string;
                feedback_note: string;
                created_by: string | null;
              }>;
              let copiedFeedback = 0;
              for (const f of feedbackRows) {
                const { error: fbErr } = await sb.from("audit_section_feedback").insert({
                  case_id: caseId,
                  report_id: newReportId,
                  section_key: f.section_key,
                  feedback_type: f.feedback_type,
                  visibility_scope: f.visibility_scope,
                  feedback_note: f.feedback_note,
                  created_by: f.created_by,
                });
                if (!fbErr) copiedFeedback += 1;
              }
              logger.info("Auditor overrides and section feedback copied to new report after rerun", {
                caseId,
                sourceReportVersion,
                newVersion: ver,
                copiedOverrides,
                copiedFeedback,
              });
              return { copiedOverrides, copiedFeedback };
            });
          }
          await complete("complete", ver);
          return { ok: true, action, version: ver };
        }
        case "regenerate_graft_integrity": {
          await step.invoke("invoke-gii", {
            function: runGraftIntegrityEstimate,
            data: { caseId, alwaysInsertIfApproved: true },
          });
          await complete("complete");
          return { ok: true, action };
        }
        case "rebuild_pdf": {
          const result = await step.invoke("invoke-pdf", {
            function: runPdfRebuild,
            data: { caseId },
          });
          const ver = (result as any)?.version;
          await complete("complete", ver);
          return { ok: true, action, version: ver };
        }
        case "full_reaudit": {
          await step.invoke("invoke-gii-full", {
            function: runGraftIntegrityEstimate,
            data: { caseId, userId: triggeredBy, alwaysInsertIfApproved: true },
          });
          const auditResult = await step.invoke("invoke-audit-full", {
            function: runAudit,
            data: { caseId, userId: triggeredBy, auditorRerunReason: data.reason },
          });
          const ver = (auditResult as any)?.version;
          const sourceReportVersionFull = data.sourceReportVersion != null ? Number(data.sourceReportVersion) : null;
          if (typeof ver === "number" && ver >= 1 && typeof sourceReportVersionFull === "number" && sourceReportVersionFull >= 1) {
            await step.run("copy-auditor-overrides-full-reaudit", async () => {
              const sb = supabaseAdmin();
              const [sourceRes, newRes] = await Promise.all([
                sb.from("reports").select("id").eq("case_id", caseId).eq("version", sourceReportVersionFull).maybeSingle(),
                sb.from("reports").select("id, summary").eq("case_id", caseId).eq("version", ver).maybeSingle(),
              ]);
              const sourceReportId = (sourceRes.data as { id?: string } | null)?.id ?? null;
              const newReport = newRes.data as { id: string; summary: Record<string, unknown> | null } | null;
              const newReportId = newReport?.id ?? null;
              if (!sourceReportId || !newReportId) return { copiedOverrides: 0, copiedFeedback: 0 };
              const summary = (newReport?.summary ?? {}) as Record<string, unknown>;
              const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | undefined;
              const domainScores = forensic?.domain_scores_v1 as { domains?: Array<{ domain_id?: string; raw_score?: number; weighted_score?: number }> } | undefined;
              const domains = Array.isArray(domainScores?.domains) ? domainScores.domains : [];
              const newAiByDomain = new Map<string, { raw: number; weighted: number | null }>();
              for (const d of domains) {
                const id = String(d.domain_id ?? "");
                if (!id) continue;
                newAiByDomain.set(id, { raw: Number(d.raw_score ?? 0), weighted: d.weighted_score != null ? Number(d.weighted_score) : null });
              }
              const { data: overrides } = await sb.from("audit_score_overrides").select("*").eq("report_id", sourceReportId);
              const rows = (overrides ?? []) as Array<{ domain_key: string; manual_score: number; manual_weighted_score: number | null; reason_category: string; override_note: string | null; visibility_scope?: string; created_by: string | null; section_key?: string | null }>;
              let copiedOverrides = 0;
              for (const row of rows) {
                const newAi = newAiByDomain.get(row.domain_key) ?? { raw: 0, weighted: null };
                const aiScore = newAi.raw;
                const aiWeightedScore = newAi.weighted;
                const manualScore = Number(row.manual_score);
                const deltaScore = Number((manualScore - aiScore).toFixed(2));
                const manualWeightedScore = row.manual_weighted_score != null ? Number(row.manual_weighted_score) : null;
                const { error: insErr } = await sb.from("audit_score_overrides").upsert(
                  { case_id: caseId, report_id: newReportId, domain_key: row.domain_key, section_key: row.section_key ?? null, ai_score: aiScore, ai_weighted_score: aiWeightedScore, manual_score: manualScore, manual_weighted_score: manualWeightedScore, delta_score: deltaScore, reason_category: row.reason_category, override_note: row.override_note, visibility_scope: row.visibility_scope ?? "internal_only", created_by: row.created_by },
                  { onConflict: "case_id,report_id,domain_key" }
                );
                if (!insErr) copiedOverrides += 1;
              }
              const { data: sectionFeedback } = await sb.from("audit_section_feedback").select("section_key, feedback_type, visibility_scope, feedback_note, created_by").eq("report_id", sourceReportId);
              const feedbackRows = (sectionFeedback ?? []) as Array<{ section_key: string; feedback_type: string; visibility_scope: string; feedback_note: string; created_by: string | null }>;
              let copiedFeedback = 0;
              for (const f of feedbackRows) {
                const { error: fbErr } = await sb.from("audit_section_feedback").insert({ case_id: caseId, report_id: newReportId, section_key: f.section_key, feedback_type: f.feedback_type, visibility_scope: f.visibility_scope, feedback_note: f.feedback_note, created_by: f.created_by });
                if (!fbErr) copiedFeedback += 1;
              }
              logger.info("Auditor overrides and section feedback copied to new report after full reaudit", { caseId, sourceReportVersion: sourceReportVersionFull, newVersion: ver, copiedOverrides, copiedFeedback });
              return { copiedOverrides, copiedFeedback };
            });
          }
          await complete("complete", ver);
          return { ok: true, action, version: ver };
        }
        default:
          await complete("failed", null, `Unknown action: ${action}`);
          throw new Error(`Unknown rerun action: ${action}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("auditor rerun failed", { caseId, action, error: msg });
      await complete("failed", null, msg);
      throw err;
    }
  }
);
