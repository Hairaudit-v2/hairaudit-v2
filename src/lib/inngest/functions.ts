import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import { buildAuditReportPdf, fetchReportImages } from "@/lib/pdf/reportBuilder";
import { runAIAudit } from "@/lib/ai/audit";
import { runGraftIntegrityModelEstimate } from "@/lib/ai/graftIntegrity";
import { runDoctorScoringNarrative, DEFAULT_PROTOCOL_CATALOG, DEFAULT_TRAINING_MODULE_CATALOG } from "@/lib/ai/runDoctorScoringNarrative";
import { notifyPatientAuditFailed, notifyAuditorAuditFailed } from "@/lib/email";
import { canSubmit } from "@/lib/auditPhotoSchemas";
import { computeDomainScoresV1, computeDoctorAiContextV1 } from "@/lib/benchmarks/domainScoring";

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
    const path = String(u.storage_path ?? "").toLowerCase();
    return cat.includes("donor_rear") || cat.includes("donor") || t.includes("donor") || path.includes("donor_rear") || path.includes("donor");
  });

  const donorIntraOrDay0 = params.donor.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    const path = String(u.storage_path ?? "").toLowerCase();
    return t.includes("day0_donor") || cat.includes("day0_donor") || t.includes("intraop") || cat.includes("intraop") || path.includes("day0") || path.includes("intraop");
  });

  const recipientDay0 = params.recipient.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    const path = String(u.storage_path ?? "").toLowerCase();
    return t.includes("day0_recipient") || cat.includes("day0_recipient") || cat.includes("any_day0") || path.includes("day0");
  });

  const recipientIntra = params.recipient.some((u) => {
    const t = String(u.type ?? "").toLowerCase();
    const cat = String(u?.metadata?.category ?? "").toLowerCase();
    const path = String(u.storage_path ?? "").toLowerCase();
    return t.includes("intraop") || cat.includes("intraop") || path.includes("intraop");
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
}) {
  const { supabase, caseId, claimedGrafts, modelOut } = params;

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
    .select("id")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) throw new Error(`graft_integrity_estimates select failed: ${selErr.message}`);

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

  if (existing?.id) {
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
    concurrency: { limit: 10 },
  },
  { event: "case/submitted" },
  async ({ event, step, logger }) => {
    const { caseId } = event.data as { caseId: string; userId: string };
    const supabase = supabaseAdmin();

    // 1) Load uploads + summary (same sources as the main audit)
    const { uploads, patientAnswers } = await step.run("load-gii-inputs", async () => {
      const [{ data: uploads, error: upErr }, { data: report, error: repErr }] = await Promise.all([
        supabase
          .from("uploads")
          .select("id, type, storage_path, metadata, created_at")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("reports")
          .select("id, summary")
          .eq("case_id", caseId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (upErr) throw new Error(`uploads load failed: ${upErr.message}`);
      if (repErr) throw new Error(`reports load failed: ${repErr.message}`);
      const summary = (report?.summary ?? {}) as Record<string, unknown>;
      const patientAnswers = (summary.patient_answers ?? null) as Record<string, unknown> | null;
      return { uploads: uploads ?? [], patientAnswers };
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

    // 2) Pick donor/recipient-relevant images (by upload category/key heuristics)
    const imageUploads = uploads.filter((u: any) => isImageUpload(u.type));
    const donorCandidates = imageUploads.filter((u: any) => {
      const t = String(u.type ?? "").toLowerCase();
      const cat = String(u?.metadata?.category ?? "").toLowerCase();
      return t.includes("donor") || cat.includes("donor") || cat.includes("donor_rear") || t.includes("day0_donor");
    });
    const recipientCandidates = imageUploads.filter((u: any) => {
      const t = String(u.type ?? "").toLowerCase();
      const cat = String(u?.metadata?.category ?? "").toLowerCase();
      return t.includes("recipient") || cat.includes("recipient") || t.includes("day0_recipient") || t.includes("intraop") || cat.includes("any_day0") || cat.includes("any_early_postop");
    });

    // Avoid duplicates (prefer donor set first)
    const donorSet = new Set(donorCandidates.map((u: any) => String(u.storage_path)));
    const recipientFiltered = recipientCandidates.filter((u: any) => !donorSet.has(String(u.storage_path)));

    // 3) Sign URLs (model sees signed URLs; model keys are storage paths)
    const donorSigned = await step.run("sign-donor-urls", async () => {
      const out: Array<{ key: string; signedUrl: string }> = [];
      for (const u of donorCandidates.slice(0, 10)) {
        const key = String(u.storage_path);
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(key, 60 * 15);
        if (data?.signedUrl) out.push({ key, signedUrl: data.signedUrl });
      }
      return out;
    });

    const recipientSigned = await step.run("sign-recipient-urls", async () => {
      const out: Array<{ key: string; signedUrl: string }> = [];
      for (const u of recipientFiltered.slice(0, 10)) {
        const key = String(u.storage_path);
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(key, 60 * 15);
        if (data?.signedUrl) out.push({ key, signedUrl: data.signedUrl });
      }
      return out;
    });

    const { score: evidenceScore, recommendedMissingPhotos } = classifyEvidenceCoverage({
      claimedGrafts,
      donor: donorCandidates,
      recipient: recipientFiltered,
    });

    // 4) Run model + persist. This function is independent of the main audit flow.
    const modelOut = await step.run("run-gii-model", async () => {
      return await runGraftIntegrityModelEstimate({
        claimed_grafts: claimedGrafts,
        donor: donorSigned,
        recipient: recipientSigned,
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
      });
    });

    logger.info("Graft Integrity Estimate saved", {
      caseId,
      claimedGrafts,
      confidence: adjusted.confidence,
      evidenceScore,
      donorImages: donorSigned.length,
      recipientImages: recipientSigned.length,
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
        await supabase
          .from("cases")
          .update({ status: "audit_failed" })
          .eq("id", caseId);
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
  { event: "case/submitted" },
  async ({ event, step, logger }) => {
    const { caseId, userId } = event.data as { caseId: string; userId: string };

    const supabase = supabaseAdmin();

    // 1) Load case
    const c = await step.run("load-case", async () => {
      const baseSelect = "id, user_id, status, submitted_at, doctor_id, clinic_id, evidence_score_doctor, evidence_score_patient";
      const res = await supabase
        .from("cases")
        .select(baseSelect)
        .eq("id", caseId)
        .maybeSingle();

      // Backward compatibility: if evidence columns don't exist yet, fallback.
      if (res.error && String(res.error.message || "").includes("evidence")) {
        const fb = await supabase
          .from("cases")
          .select("id, user_id, status, submitted_at, doctor_id, clinic_id")
          .eq("id", caseId)
          .maybeSingle();
        if (fb.error) throw new Error(`cases load failed: ${fb.error.message}`);
        if (!fb.data) throw new Error("Case not found");
        if (fb.data.user_id !== userId) throw new Error("Forbidden: not owner");
        return fb.data as any;
      }

      if (res.error) throw new Error(`cases load failed: ${res.error.message}`);
      if (!res.data) throw new Error("Case not found");
      if (res.data.user_id !== userId) throw new Error("Forbidden: not owner");
      return res.data as any;
    });

    // 2) Mark processing (optional but helpful)
    await step.run("mark-processing", async () => {
      const { error } = await supabase
        .from("cases")
        .update({ status: "processing" })
        .eq("id", caseId);

      if (error) throw new Error(`cases update failed: ${error.message}`);
    });

    // 3) Verify uploads
    const uploads = await step.run("load-uploads", async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("id, type, storage_path, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`uploads load failed: ${error.message}`);
      return data ?? [];
    });

    const patientPhotos = uploads.filter((u) => String(u.type ?? "").startsWith("patient_photo:"));
    if (!canSubmit("patient", patientPhotos.map((u) => ({ type: u.type })))) {
      // Mark case “needs_more_info” or revert to draft
      await step.run("mark-missing", async () => {
        await supabase
          .from("cases")
          .update({ status: "draft" })
          .eq("id", caseId);
      });
      throw new Error("Missing required patient photos (Current Front, Top, Donor rear)");
    }

    // 4) Load existing report summary (patient/doctor/clinic answers)
    const existingSummary = await step.run("load-report-summary", async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, summary")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`reports load failed: ${error.message}`);
      const s = (data?.summary ?? {}) as Record<string, unknown>;
      return {
        patient_answers: s.patient_answers ?? null,
        doctor_answers: s.doctor_answers ?? null,
        clinic_answers: s.clinic_answers ?? null,
      };
    });

    // 5) Get signed URLs for images (for AI vision)
    const imageUrls = await step.run("get-signed-image-urls", async () => {
      const imageUploads = uploads.filter((u) => isImageUpload(u.type));
      const urls: string[] = [];
      for (const u of imageUploads.slice(0, 10)) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(u.storage_path, 60 * 15);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      return urls;
    });

    // 6) Run AI audit (answers + images)
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

      return await runAIAudit({
        patient_answers: patientAnswers,
        doctor_answers: existingSummary.doctor_answers as Record<string, unknown> | null,
        clinic_answers: existingSummary.clinic_answers as Record<string, unknown> | null,
        // Pass structured advanced inputs to GPT-5.2 (backward-compatible; optional).
        enhanced_patient_answers: (enhanced as any) ?? null,
        patient_baseline: (baseline as any) ?? null,
        imageUrls,
      });
    });

    // 6a) Doctor scoring narrative (GPT; non-blocking). Deterministic ai_context remains truth.
    const scoringNarrative = await step.run("doctor-scoring-narrative", async () => {
      try {
        const doctorAnswers = existingSummary.doctor_answers as Record<string, unknown> | null;

        const ctx = computeDoctorAiContextV1({
          uploads: uploads as any,
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
        uploads: uploads as any,
        caseRow: {
          evidence_score_doctor: (c as any)?.evidence_score_doctor ?? null,
          evidence_score_patient: (c as any)?.evidence_score_patient ?? null,
          doctor_id: (c as any)?.doctor_id ?? null,
          clinic_id: (c as any)?.clinic_id ?? null,
        },
        doctorAnswersRaw: (existingSummary.doctor_answers as any) ?? null,
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
    const totalViews = obs.length || imageUrls.length || 0;
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

    await step.run("build-and-upload-pdf", async () => {
      // Inlined to avoid 401 from Vercel Deployment Protection when fetch'ing build-pdf API
      const supabase = supabaseAdmin();
      const images = await fetchReportImages(supabase, BUCKET, uploads.map((u) => ({ type: u.type, storage_path: u.storage_path })));
      const content = {
        caseId,
        version: nextVersion,
        generatedAt: new Date().toLocaleString(),
        score: aiResult.score,
        donorQuality: aiResult.donor_quality,
        graftSurvival: aiResult.graft_survival_estimate,
        notes: aiResult.notes || undefined,
        findings: aiResult.findings,
        model: aiResult.model,
        uploadCount: uploads.length,
        forensic: {
          summary: aiResult.summary,
          key_findings: aiResult.key_findings as any,
          red_flags: aiResult.red_flags as any,
          non_medical_disclaimer: aiResult.non_medical_disclaimer,
          domain_scores_v1: {
            version: 1,
            domains: (v1 as any)?.domains ?? undefined,
          },
          benchmark: (v1 as any)?.benchmark ?? undefined,
          completeness_index_v1: (v1 as any)?.completeness_index_v1 ?? undefined,
          confidence_model_v1: (v1 as any)?.confidence_model_v1 ?? undefined,
          overall_scores_v1: (v1 as any)?.overall_scores_v1 ?? undefined,
          tiers_v1: (v1 as any)?.tiers_v1 ?? undefined,
        },
        graftIntegrity: graftIntegrity as any,
        confidencePanel: {
          photoCount: uploads.length,
          missingCategories: aiResult.data_quality?.missing_photos ?? [],
          confidenceScore: confForReport,
          confidenceLabel: confLabelForReport,
          limitations: aiResult.data_quality?.limitations ?? [],
        },
        radar: {
          section_scores: aiResult.section_scores as unknown as Record<string, number>,
          overall_score: aiResult.overall_score,
          confidence: confForReport,
        },
        areaScores: {
          domains: {
            donor_management: aiResult.section_scores.donor_management,
            extraction_quality: aiResult.section_scores.extraction_quality,
            graft_handling: aiResult.section_scores.graft_handling_and_viability,
            recipient_implantation: aiResult.section_scores.recipient_placement,
            safety_documentation_aftercare: aiResult.section_scores.post_op_course_and_aftercare,
          },
          sections: aiResult.section_scores,
        },
      };
      const pdfBuffer = await buildAuditReportPdf({ ...content, images });
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from((pdfBuffer as { data?: number[] })?.data ?? []);
      const { error } = await supabase.storage.from(BUCKET).upload(pdfPath, buf, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error) throw new Error(`storage upload failed: ${error.message}`);
      return { pdfPath, bytes: buf.length };
    });

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

      const summary = {
        ...existingSummary,
        doctor_answers: doctorAnswersBase,
        score: aiResult.score,
        donor_quality: aiResult.donor_quality,
        graft_survival_estimate: aiResult.graft_survival_estimate,
        notes: aiResult.notes,
        findings: aiResult.findings,
        // Store the full forensic audit payload for downstream UI + analytics
        forensic_audit: {
          overall_score: aiResult.overall_score,
          confidence: aiResult.confidence,
          confidence_label: aiResult.confidence_label,
          data_quality: aiResult.data_quality,
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
        },
      };

      const { error } = await supabase.from("reports").insert({
        case_id: caseId,
        version: nextVersion,
        pdf_path: pdfPath,
        summary,
        status: "complete",
      });

      if (error) throw new Error(`reports insert failed: ${error.message}`);
    });

    // 11) Mark case complete
    await step.run("mark-complete", async () => {
      const { error } = await supabase
        .from("cases")
        .update({ status: "complete" })
        .eq("id", caseId);

      if (error) throw new Error(`cases complete update failed: ${error.message}`);
    });

    logger.info("Audit pipeline complete", { caseId, nextVersion, pdfPath });
    return { ok: true, version: nextVersion, pdfPath };
  }
);
