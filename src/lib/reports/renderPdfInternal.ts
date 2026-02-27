import { createClient } from "@supabase/supabase-js";
import { buildAuditReportPdf, normalizeAuditMode, type AuditReportContent, type ReportImage } from "@/lib/pdf/reportBuilder";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNum(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function toNumberRecord(x: unknown): Record<string, number> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

async function downloadImagesForCase(args: {
  supabase: ReturnType<typeof supabaseAdmin>;
  bucket: string;
  caseId: string;
}): Promise<ReportImage[]> {
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
  const out: ReportImage[] = [];

  for (const u of imgUploads) {
    try {
      const storagePath = String((u as any)?.storage_path ?? "");
      if (!storagePath) continue;
      const { data, error } = await args.supabase.storage.from(args.bucket).download(storagePath);
      if (error || !data) continue;
      const ab = await data.arrayBuffer();
      const buffer = Buffer.from(ab);
      const label =
        String((u as any)?.metadata?.label ?? "")
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

  const supabase = supabaseAdmin();
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

  // Load the report summary for this version (fallback to latest)
  const { data: reportRow } = await supabase
    .from("reports")
    .select("summary, created_at, version")
    .eq("case_id", caseId)
    .eq("version", version)
    .maybeSingle();

  const { data: latestRow } =
    reportRow?.summary
      ? { data: null as any }
      : await supabase
          .from("reports")
          .select("summary, created_at, version")
          .eq("case_id", caseId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

  const effective = (reportRow?.summary ? reportRow : latestRow) as any;
  const summary = (effective?.summary ?? {}) as any;
  const forensic = (summary?.forensic_audit ?? summary?.forensic ?? null) as any;

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

  // Confidence (0–1). Use forensic if present; otherwise derive a safe floor.
  const photoCount = Number((summary?.uploadCount ?? summary?.upload_count) ?? 0) || 0;
  const missingCategories = Array.isArray(forensic?.data_quality?.missing_photos)
    ? forensic.data_quality.missing_photos
    : Array.isArray(forensic?.data_quality?.missing_inputs)
      ? forensic.data_quality.missing_inputs
      : [];
  const missingPenalty = clamp((missingCategories.length || 0) / 6, 0, 1) * 0.25;
  const photoFactor = clamp(photoCount / 6, 0, 1);
  const derivedConfidence = clamp(0.45 + 0.35 * photoFactor - missingPenalty, 0.45, 0.92);
  const conf = clamp(toNum(forensic?.confidence) ?? derivedConfidence, 0.45, 0.95);
  const confLabel = conf < 0.55 ? "low" : conf < 0.8 ? "medium" : "high";

  const images = await downloadImagesForCase({ supabase, bucket, caseId });

  const findings =
    Array.isArray(summary?.findings) ? summary.findings :
    Array.isArray(summary?.highlights) ? summary.highlights :
    [];

  const content: AuditReportContent = {
    caseId,
    version: Number(version),
    generatedAt: new Date().toLocaleString(),
    auditMode,
    score: overall,
    donorQuality: String(summary?.donor_quality ?? summary?.key_metrics?.donor_quality ?? "—"),
    graftSurvival: String(summary?.graft_survival_estimate ?? summary?.key_metrics?.graft_survival_estimate ?? "—"),
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
      domains: Object.keys(domains).length ? domains : undefined,
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
    images,
  };

  const pdfBuffer = await buildAuditReportPdf(content);
  const pdfPath = `${caseId}/v${version}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  return { pdfPath, auditMode, caseId };
}

