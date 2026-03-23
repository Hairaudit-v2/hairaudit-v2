import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildAuditReportPdf,
  normalizeAuditMode,
  type AuditReportContent,
  type ReportImage,
} from "@/lib/pdf/reportBuilder";
import { buildPdfUrl } from "@/lib/reports/pdfUrl";
import { signRenderToken } from "@/lib/reports/internalRenderToken";
import { generateReportPdfFromUrl } from "@/lib/pdf/generateReportPdf";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";
import { getBaseUrl } from "@/lib/reports/getBaseUrl";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import {
  assertPdfReady,
  deriveDomainScoresFromSections,
  deriveDomainScoresHeuristic,
  toNumberRecord,
} from "@/lib/reports/pdfReadiness";
import { loadLatestEvidenceManifest } from "@/lib/evidence/prepareCaseEvidence";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import { effectivePatientPhotoCategoryKey } from "@/lib/uploads/patientPhotoAuditMeta";
import { evaluateEvidence, type EvidenceEvaluationResult } from "@/lib/evidence/evidenceEvaluator";
import { enrichKeyMetricsAfterNormalize } from "@/lib/evidence/evidenceMissingCopy";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNum(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function normalizeMetric(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text.toLowerCase() === "unknown" || text.toLowerCase() === "n/a") {
    return "Insufficient evidence";
  }
  return text;
}

async function downloadImagesForCase(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  bucket: string;
  caseId: string;
}): Promise<ReportImage[]> {
  const manifest = await loadLatestEvidenceManifest({
    supabase: args.supabase,
    caseId: args.caseId,
    status: "ready",
  });
  const prepared = Array.isArray(manifest?.prepared_images)
    ? (manifest.prepared_images as Array<{ prepared_path?: string; category?: string }>)
    : [];

  const out: ReportImage[] = [];
  for (const p of prepared) {
    try {
      const preparedPath = String(p.prepared_path ?? "");
      if (!preparedPath) continue;
      const { data, error } = await args.supabase.storage.from(args.bucket).download(preparedPath);
      if (error || !data) continue;
      const buffer = Buffer.from(await data.arrayBuffer());
      out.push({
        buffer,
        label: String(p.category ?? "prepared evidence"),
        type: "prepared_evidence",
      });
    } catch {
      // Skip failed prepared evidence image and continue.
    }
  }
  if (out.length > 0) return out;

  // Legacy fallback if evidence manifest isn't available yet.
  const { data: uploads } = await args.supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", args.caseId)
    .order("created_at", { ascending: true });

  const isImg = (u: any) => {
    const t = String(u?.type ?? "").toLowerCase();
    return t.startsWith("patient_photo:") || t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png") || t.includes("jpeg") || t.includes("webp");
  };

  const imgUploads = (uploads ?? []).filter(isImg);

  for (const u of imgUploads) {
    try {
      const storagePath = String((u as any)?.storage_path ?? "");
      if (!storagePath) continue;
      const { data, error } = await args.supabase.storage.from(args.bucket).download(storagePath);
      if (error || !data) continue;
      const ab = await data.arrayBuffer();
      const buffer = Buffer.from(ab);
      const eff = effectivePatientPhotoCategoryKey(u as { type?: string; metadata?: unknown });
      const label =
        eff != null
          ? auditorPatientPhotoCategoryLabel(eff)
          : String((u as any)?.metadata?.label ?? "")
              .trim() ||
            String((u as any)?.metadata?.category ?? "")
              .trim() ||
            String((u as any)?.type ?? "photo");
      out.push({ buffer, label, type: String((u as any)?.type ?? "") });
    } catch {
      // Ignore individual image failures; PDF should still render.
    }
  }

  return out;
}

export async function renderAndUploadPdfForCase(args: {
  caseId: string;
  auditMode?: string;
  version?: number;
  baseUrl?: string;
}) {
  const caseId = String(args.caseId ?? "").trim();
  if (!caseId) throw new Error("Missing caseId");

  const auditMode = normalizeAuditMode(args.auditMode);

  const supabase = createSupabaseAdminClient();
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  let version =
    Number.isFinite(Number(args.version)) && Number(args.version) > 0
      ? Math.floor(Number(args.version))
      : null;

  if (!version) {
    const { data } = await supabase
      .from("reports")
      .select("version")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    version = Number(data?.version ?? 0) + 1;
  }

  // Load the report summary for this version (deterministic: no fallback)
  const { data: reportRow } = await supabase
    .from("reports")
    .select("id, summary, created_at, version, status, pdf_path")
    .eq("case_id", caseId)
    .eq("version", version)
    .maybeSingle();

  if (!reportRow) {
    throw Object.assign(new Error(`AUDIT_NOT_READY: report row not found for v${version}`), {
      code: "AUDIT_NOT_READY" as const,
    });
  }
  const { data: caseRow } = await supabase
    .from("cases")
    .select("status")
    .eq("id", caseId)
    .maybeSingle();
  const summary = (reportRow.summary ?? {}) as any;
  assertPdfReady({
    caseStatus: (caseRow as { status?: string | null } | null)?.status ?? null,
    reportStatus: (reportRow as { status?: string | null }).status ?? null,
    summary,
  });

  const forensic = (summary?.forensic_audit ?? summary?.forensic ?? null) as any;

  // Load graft integrity for PDF (only approved appears in patient PDF; addGraftIntegrityIndex handles filtering)
  let giiRow: any = null;
  try {
    const res = await supabase
    .from("graft_integrity_estimates")
    .select(
      "claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, confidence, confidence_label, limitations, auditor_status"
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
    giiRow = res.error ? null : res.data;
  } catch {
    giiRow = null;
  }

  const gii = giiRow as any;
  const graftIntegrity =
    gii != null
      ? {
          auditor_status: (String(gii?.auditor_status ?? "pending") ?? "pending") as "approved" | "pending" | "needs_more_evidence" | "rejected",
          claimed_grafts: toNum(gii?.claimed_grafts),
          estimated_extracted: { min: toNum(gii?.estimated_extracted_min), max: toNum(gii?.estimated_extracted_max) },
          estimated_implanted: { min: toNum(gii?.estimated_implanted_min), max: toNum(gii?.estimated_implanted_max) },
          variance_claimed_vs_implanted_pct: {
            min: toNum(gii?.variance_claimed_vs_implanted_min_pct),
            max: toNum(gii?.variance_claimed_vs_implanted_max_pct),
          },
          confidence: clamp(Number(gii?.confidence ?? 0.45), 0, 1),
          confidence_label: (["low", "medium", "high"].includes(String(gii?.confidence_label ?? "")) ? gii.confidence_label : "medium") as "low" | "medium" | "high",
          limitations: Array.isArray(gii?.limitations) ? gii.limitations : [],
        }
      : undefined;

  const overallFromForensic = toNum(forensic?.overall_score);
  const overallFromSummary = toNum(summary?.overall_score ?? summary?.score);
  const overall = overallFromForensic ?? overallFromSummary ?? null;

  const sectionScores = toNumberRecord(
    summary?.computed?.component_scores?.sections ??
      summary?.section_scores ??
      forensic?.section_scores ??
      null
  );

  const domains = toNumberRecord(
    summary?.computed?.component_scores?.domains ??
      summary?.area_scores ??
      null
  );
  const derivedDomains =
    Object.keys(domains).length > 0
      ? domains
      : deriveDomainScoresFromSections(
          sectionScores,
          ((rubric as { domains?: Array<{ domain_id: string; sections?: Array<{ section_id: string }> }> }).domains ??
            []) as Array<{ domain_id: string; sections?: Array<{ section_id: string }> }>
        );
  const effectiveDomains =
    Object.keys(derivedDomains).length > 0 ? derivedDomains : deriveDomainScoresHeuristic(sectionScores);

  // Confidence (0–1). Use forensic if present; otherwise derive a safe floor.
  // Prefer explicit counts if stored; otherwise fall back to downloaded images length.
  const photoCountStored = Number((summary?.uploadCount ?? summary?.upload_count) ?? 0) || 0;
  const missingCategories = Array.isArray(forensic?.data_quality?.missing_photos)
    ? forensic.data_quality.missing_photos
    : Array.isArray(forensic?.data_quality?.missing_inputs)
      ? forensic.data_quality.missing_inputs
      : [];
  const missingPenalty = clamp((missingCategories.length || 0) / 6, 0, 1) * 0.25;
  const images = await downloadImagesForCase({ supabase, bucket, caseId });
  let pdfKitEvidenceEvaluation: EvidenceEvaluationResult | null = null;
  try {
    const { data: uploadRows, error: evErr } = await supabase
      .from("uploads")
      .select("type, metadata")
      .eq("case_id", caseId);
    if (!evErr && uploadRows) {
      pdfKitEvidenceEvaluation = evaluateEvidence(uploadRows as Parameters<typeof evaluateEvidence>[0]);
    }
  } catch {
    pdfKitEvidenceEvaluation = null;
  }
  const photoCount = photoCountStored || images.length || 0;
  const photoFactor = clamp(photoCount / 6, 0, 1);
  const derivedConfidence = clamp(0.45 + 0.35 * photoFactor - missingPenalty, 0.45, 0.92);
  const conf = clamp(toNum(forensic?.confidence) ?? derivedConfidence, 0.45, 0.95);
  const confLabel = conf < 0.55 ? "low" : conf < 0.8 ? "medium" : "high";

  const findings =
    Array.isArray(summary?.findings) ? summary.findings :
    Array.isArray(summary?.highlights) ? summary.highlights :
    [];

  const keyMetricsRaw = enrichKeyMetricsAfterNormalize(
    {
      donorQuality: normalizeMetric(summary?.donor_quality ?? summary?.key_metrics?.donor_quality),
      graftSurvival: normalizeMetric(summary?.graft_survival_estimate ?? summary?.key_metrics?.graft_survival_estimate),
      transectionRisk: normalizeMetric(summary?.key_metrics?.transection_risk),
      implantationDensity: normalizeMetric(summary?.key_metrics?.implantation_density),
      hairlineNaturalness: normalizeMetric(summary?.key_metrics?.hairline_naturalness),
      donorScarVisibility: normalizeMetric(summary?.key_metrics?.donor_scar_visibility),
    },
    pdfKitEvidenceEvaluation
  );

  const summaryEvCovPdf = Number((summary as { evidenceCoverageScore?: unknown })?.evidenceCoverageScore);
  const evidenceCoverageScorePdf =
    Number.isFinite(summaryEvCovPdf) && summaryEvCovPdf >= 0
      ? Math.round(Math.max(0, Math.min(100, summaryEvCovPdf)))
      : pdfKitEvidenceEvaluation != null
        ? pdfKitEvidenceEvaluation.overallCoverageScore
        : null;

  const content: AuditReportContent = {
    caseId,
    version: Number(version),
    generatedAt: reportRow?.created_at ? new Date(reportRow.created_at).toLocaleString() : new Date().toLocaleString(),
    auditMode,
    score: overall,
    evidenceCoverageScore: evidenceCoverageScorePdf,
    donorQuality: keyMetricsRaw.donorQuality,
    graftSurvival: keyMetricsRaw.graftSurvival,
    notes: typeof summary?.notes === "string" ? summary.notes : undefined,
    findings,
    model: String(forensic?.model ?? summary?.model ?? ""),
    uploadCount: photoCount || images.length,
    confidencePanel: {
      photoCount: photoCount || images.length,
      missingCategories,
      confidenceScore: conf,
      confidenceLabel: String(forensic?.confidence_label ?? confLabel),
      limitations: Array.isArray(forensic?.data_quality?.limitations) ? forensic.data_quality.limitations : [],
    },
    radar: Object.keys(sectionScores).length
      ? { section_scores: sectionScores, overall_score: Number(overall ?? 0), confidence: conf }
      : undefined,
    areaScores: {
      domains: Object.keys(effectiveDomains).length ? effectiveDomains : undefined,
      sections: Object.keys(sectionScores).length ? sectionScores : undefined,
    },
    forensic: forensic
      ? {
          summary: typeof forensic?.summary === "string" ? forensic.summary : undefined,
          key_findings: Array.isArray(forensic?.key_findings) ? forensic.key_findings : undefined,
          red_flags: Array.isArray(forensic?.red_flags) ? forensic.red_flags : undefined,
          non_medical_disclaimer: typeof forensic?.non_medical_disclaimer === "string" ? forensic.non_medical_disclaimer : undefined,
          domain_scores_v1: forensic?.domain_scores_v1,
          benchmark: forensic?.benchmark,
          completeness_index_v1: forensic?.completeness_index_v1,
          confidence_model_v1: forensic?.confidence_model_v1,
          overall_scores_v1: forensic?.overall_scores_v1,
          tiers_v1: forensic?.tiers_v1,
        }
      : undefined,
    graftIntegrity: graftIntegrity ?? undefined,
    images,
  };

  const renderer = pdfEnvConfig.getPdfRenderer();

  let pdfBuffer: Buffer;

  if (renderer === "pdfkit") {
    pdfBuffer = await buildAuditReportPdf(content);
  } else {
    const tokenSecret =
      String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
      String(process.env.INTERNAL_API_KEY ?? "").trim() ||
      String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

    if (!tokenSecret) {
      throw new Error("Missing REPORT_RENDER_TOKEN/INTERNAL_API_KEY/SUPABASE_SERVICE_ROLE_KEY for PDF render.");
    }

    const token = signRenderToken({
      caseId,
      auditMode,
      exp: Date.now() + 10 * 60 * 1000,
      secret: tokenSecret,
    });

    const baseUrl = getBaseUrl(args.baseUrl);
    const reportId = String((reportRow as { id?: string }).id ?? "").trim() || null;
    const url = buildPdfUrl({ caseId, auditMode, token, baseUrl, reportId });

    pdfBuffer = await generateReportPdfFromUrl(url);
  }

  const pdfPath = `${caseId}/v${version}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  return { pdfPath, auditMode, caseId, renderer };
}

