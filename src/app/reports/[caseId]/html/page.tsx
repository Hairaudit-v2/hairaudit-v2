import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "@/lib/roles";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { scoreAudit } from "@/lib/audit/score";
import ScoreAreaGraph from "@/components/reports/ScoreAreaGraph";
import { buildRubricTitles } from "@/lib/audit/rubricTitles";
import { buildReportViewModel, normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";
import { resolveAuditModeFromCaseAccess } from "@/lib/reports/accessMode";
import { verifyRenderToken } from "@/lib/reports/internalRenderToken";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import { getTranslation } from "@/lib/i18n/getTranslation";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";
import { applyAuditorOverridesToSummary, type OverrideRow } from "@/lib/auditor/applyOverrides";
import {
  filterReportVisibleOverrides,
  filterReportVisibleSectionFeedback,
  buildAuditorChangeSummaryLines,
  buildAuditorNoteForDomain,
  type OverrideRowWithVisibility,
  type SectionFeedbackRow,
} from "@/lib/auditor/visibility";
import {
  computePatientImageEvidenceQualityFromCaseUploads,
  PATIENT_IMAGE_EVIDENCE_QUALITY_GROUP_ORDER,
  PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS,
} from "@/lib/audit/patientImageEvidenceConfidence";
import { isInternalImageEvidenceQualityPanelEnabled } from "@/lib/features/enableInternalImageEvidenceQualityPanel";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import { effectivePatientPhotoCategoryKey } from "@/lib/uploads/patientPhotoAuditMeta";

function reportUploadImageAlt(u: { type?: string | null; metadata?: unknown }): string {
  const t = String(u.type ?? "");
  if (t.toLowerCase().startsWith("patient_photo:")) {
    const eff = effectivePatientPhotoCategoryKey(u);
    if (eff) return auditorPatientPhotoCategoryLabel(eff);
  }
  return t
    .replace(/^patient_photo:|^doctor_photo:|^clinic_photo:/i, "")
    .replace(/_/g, " ")
    .trim();
}

type Summary = {
  score?: number | string;
  donor_quality?: string;
  graft_survival_estimate?: string;
  notes?: string;
  findings?: string[];
  highlights?: string[];
    forensic_audit?: {
    auditMode?: "patient" | "full";
    overall_score?: number;
    confidence?: number;
    confidence_label?: "low" | "medium" | "high";
    data_quality?: { missing_inputs?: string[]; missing_photos?: string[]; limitations?: string[] };
    section_scores?: Record<string, number>;
    key_findings?: { title?: string; severity?: string; evidence?: string[]; impact?: string; recommended_next_step?: string }[];
    red_flags?: { flag?: string; why_it_matters?: string; evidence?: string[] }[];
    photo_observations?: {
      image_url?: string;
      suspected_view?: string;
      what_can_be_assessed?: string[];
      what_cannot?: string[];
      observations?: string[];
      confidence?: number;
    }[];
    summary?: string;
    non_medical_disclaimer?: string;
    model?: string;
    domain_scores_v1?: {
      version?: number;
      domains?: Array<{
        domain_id?: string;
        title?: string;
        raw_score?: number;
        confidence?: number;
        evidence_grade?: string;
        weighted_score?: number;
        drivers?: string[];
        limiters?: string[];
        improvement_plan?: Array<{ priority?: number; action?: string; why?: string; evidence_needed?: string[] }>;
      }>;
    };
    benchmark?: { eligible?: boolean; gate_version?: string; reasons?: string[] };
  };
};

export default async function ReportHtmlPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{ token?: string; auditMode?: string }>;
}) {
  const { caseId } = await params;
  const seoLocale = await resolvePublicSeoLocale();
  const tc = (key: TranslationKey) => getTranslation(key, seoLocale);
  const sp = (await (searchParams ?? Promise.resolve({}))) as { token?: string; auditMode?: string };
  const token = sp?.token ?? "";
  const requestedAuditMode = normalizeAuditMode(sp?.auditMode);

  const tokenSecret =
    String(process.env.REPORT_RENDER_TOKEN ?? "").trim() ||
    String(process.env.INTERNAL_API_KEY ?? "").trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const tokenPayload = tokenSecret ? verifyRenderToken(token, tokenSecret) : null;
  const allowToken = !!tokenPayload && tokenPayload.caseId === caseId && tokenPayload.auditMode === requestedAuditMode;

  let sessionUserId: string | null = null;
  let sessionRole: string = "patient";
  if (!allowToken) {
    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) redirect("/login");
    sessionUserId = user.id;
    sessionRole = parseRole((user.user_metadata as Record<string, unknown>)?.role) || "patient";
  }

  const supabase = createSupabaseAdminClient();

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>{tc("reports.chrome.caseNotFoundTitle")}</h1>
        <p>{tc("reports.chrome.caseNotFoundBody")}</p>
        <p style={{ fontFamily: "monospace" }}>{caseId}</p>
      </div>
    );
  }

  if (sessionUserId) {
    try {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionUserId).maybeSingle();
      if (profile?.role) sessionRole = parseRole(profile.role) || "patient";
    } catch {
      // profiles may not exist
    }
  }

  if (sessionUserId) {
    const allowed =
      sessionUserId === c.user_id ||
      sessionUserId === c.patient_id ||
      sessionUserId === c.doctor_id ||
      sessionUserId === c.clinic_id ||
      sessionRole === "auditor";
    if (!allowed) redirect("/dashboard");
  }

  let auditMode: AuditMode = "patient";
  if (allowToken && tokenPayload) {
    auditMode = tokenPayload.auditMode;
  } else if (sessionUserId) {
    auditMode = resolveAuditModeFromCaseAccess({
      role: sessionRole,
      userId: sessionUserId,
      caseRow: c,
    });
  }
  auditMode = normalizeAuditMode(auditMode);

  const { data: uploads, error: upErr } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (upErr) {
    console.error("uploads error:", upErr.message);
  }

  let imageEvidenceQualityForReport: ReturnType<typeof computePatientImageEvidenceQualityFromCaseUploads> | null = null;
  if (sessionRole === "auditor" && isInternalImageEvidenceQualityPanelEnabled()) {
    try {
      imageEvidenceQualityForReport = computePatientImageEvidenceQualityFromCaseUploads(uploads ?? []);
    } catch (e) {
      console.error("[reports/html] image evidence quality compute failed", { caseId, error: e });
    }
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";

  // Generate signed URLs for image uploads so Playwright can embed them
  const imageUploads = (uploads ?? []).filter((u) => {
    const t = String(u.type ?? "").toLowerCase();
    return t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png");
  });

  const signedImages = await Promise.all(
    imageUploads.map(async (u) => {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(u.storage_path, 60 * 10);
      return { ...u, signedUrl: data?.signedUrl ?? null };
    })
  );

  // Load latest report summary (for audit scores, findings, etc.)
  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, version, summary, created_at")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let summary = (latestReport?.summary ?? {}) as Summary & Record<string, unknown>;
  let reportVisibleOverrides: OverrideRowWithVisibility[] = [];
  let reportVisibleFeedback: SectionFeedbackRow[] = [];
  if (latestReport?.id) {
    const [
      { data: overrides },
      { data: sectionFeedback },
    ] = await Promise.all([
      supabase
        .from("audit_score_overrides")
        .select("domain_key, ai_score, ai_weighted_score, manual_score, manual_weighted_score, delta_score, override_note, visibility_scope")
        .eq("report_id", latestReport.id),
      supabase
        .from("audit_section_feedback")
        .select("section_key, feedback_note, visibility_scope")
        .eq("report_id", latestReport.id),
    ]);
    const overrideRows = (overrides ?? []) as OverrideRowWithVisibility[];
    if (overrideRows.length > 0) {
      summary = applyAuditorOverridesToSummary(summary as Record<string, unknown>, overrideRows as OverrideRow[]) as typeof summary;
    }
    reportVisibleOverrides = filterReportVisibleOverrides(overrideRows);
    reportVisibleFeedback = filterReportVisibleSectionFeedback((sectionFeedback ?? []) as SectionFeedbackRow[]);
  }
  const auditorChangeSummaryLines = buildAuditorChangeSummaryLines(reportVisibleOverrides);
  const hasReportVisibleOverrides = reportVisibleOverrides.length > 0;
  const findings = Array.isArray(summary.findings) ? summary.findings : (summary.highlights ?? []);
  const forensic = summary.forensic_audit;
  const domainV1 = forensic?.domain_scores_v1?.domains ?? null;
  const benchmark = forensic?.benchmark ?? null;

  // Compute rubric score if answers exist (same as print route)
  let computed = summary?.computed ?? null;
  type AuditAnswers = Parameters<typeof scoreAudit>[1];
  const rawAnswers = summary?.answers ?? summary?.audit_answers ?? summary?.scorecard_answers ?? null;
  const answers: AuditAnswers | null =
    rawAnswers && typeof rawAnswers === "object" ? (rawAnswers as AuditAnswers) : null;
  const auditRubric = rubric as unknown as Parameters<typeof scoreAudit>[0];
  if (answers) {
    try {
      computed = scoreAudit(auditRubric, answers);
    } catch (e) {
      console.error("scoreAudit failed:", e);
    }
  }
  const comp = (computed as { component_scores?: { domains?: Record<string, number>; sections?: Record<string, number> } } | null)?.component_scores ?? {};
  const fallbackDomains = summary?.area_scores ?? undefined;
  const fallbackSections = summary?.section_scores ?? undefined;
  const domains = comp.domains ?? fallbackDomains;
  const sections = comp.sections ?? fallbackSections;
  const domainsSafe = domains ?? undefined;
  const sectionsSafe = sections ?? undefined;
  const viewModel = buildReportViewModel({
    auditMode,
    content: {
      caseId,
      version: Number(latestReport?.version ?? 1),
      generatedAt: new Date().toLocaleString(),
      auditMode,
      score: typeof summary.score === "number" ? summary.score : undefined,
      donorQuality: summary.donor_quality,
      graftSurvival: summary.graft_survival_estimate,
      notes: summary.notes,
      findings,
      areaScores: {
        domains: domainsSafe as Record<string, number> | undefined,
        sections: sectionsSafe as Record<string, number> | undefined,
      },
      forensic: forensic as any,
      images: [],
    },
    rawCase: c,
    uploads,
    aiResult: summary,
  });
  const isAuditorMode = viewModel.auditMode === "auditor";
  const { domainTitles, sectionTitles } = buildRubricTitles(
    rubric as { domains?: { domain_id: string; title: string; sections?: { section_id: string; title: string }[] }[] }
  );

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>{tc("reports.chrome.html.documentTitle")}</title>
        <style>{`
          @page { size: A4; margin: 16mm 14mm; }
          body { font-family: Arial, sans-serif; color: #111; }
          .wrap { max-width: 900px; margin: 0 auto; }
          .header { display:flex; align-items:center; justify-content:space-between; border-bottom: 2px solid #111; padding-bottom: 12px; }
          .brand { display:flex; gap:12px; align-items:center; }
          .logo {
            width: 44px; height: 44px; border: 2px solid #111; border-radius: 10px;
            display:flex; align-items:center; justify-content:center; font-weight: 800;
          }
          h1 { margin: 0; font-size: 22px; }
          .muted { color:#555; font-size: 12px; }
          .section { margin-top: 18px; padding-top: 12px; border-top: 1px solid #ddd; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f5f5f5; text-align: left; }
          .gallery { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
          .imgCard { border: 1px solid #ddd; border-radius: 10px; padding: 8px; }
          .imgCard img { width: 100%; height: 260px; object-fit: cover; border-radius: 8px; }
          .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color:#666; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <div className="header">
            <div className="brand">
              <div className="logo">HA</div>
              <div>
                <h1>{tc("reports.chrome.html.pageTitle")}</h1>
                <div className="muted">{tc("reports.chrome.html.tagline")}</div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {tc("reports.chrome.html.generatedLinePrefix")} {new Date().toLocaleString()}
                </div>
              </div>
            </div>
            <div className="muted" style={{ textAlign: "right" }}>
              {tc("reports.chrome.html.caseIdLabel")}
              <br />
              <span style={{ fontFamily: "monospace" }}>{caseId}</span>
            </div>
          </div>

          <div className="section">
            <div className="muted">{tc("reports.chrome.html.caseTitleLabel")}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.title ?? tc("reports.chrome.untitledCase")}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {tc("reports.chrome.html.statusPrefix")} {c.status} • {tc("reports.chrome.html.createdPrefix")}{" "}
              {new Date(c.created_at).toLocaleString()}
            </div>
          </div>

          <div className="section">
            <h2 style={{ fontSize: 16, margin: 0 }}>{tc("reports.chrome.html.uploadsHeading")}</h2>

            {(!uploads || uploads.length === 0) ? (
              <div className="muted" style={{ marginTop: 8 }}>{tc("reports.chrome.html.noUploads")}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{tc("reports.chrome.html.colType")}</th>
                    <th>{tc("reports.chrome.html.colStoragePath")}</th>
                    <th>{tc("reports.chrome.html.colUploaded")}</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id}>
                      <td>{u.type}</td>
                      <td style={{ fontFamily: "monospace" }}>{u.storage_path}</td>
                      <td>{new Date(u.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {signedImages.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, marginTop: 14, marginBottom: 0 }}>{tc("reports.chrome.html.imageGalleryHeading")}</h3>
                <div className="gallery">
                  {signedImages.map((img) => (
                    <div className="imgCard" key={img.id}>
                      {img.signedUrl ? (
                        <img
                          src={img.signedUrl}
                          alt={img.type ? reportUploadImageAlt(img) : tc("reports.chrome.html.imageAltFallback")}
                        />
                      ) : (
                        <div className="muted">{tc("reports.chrome.html.imageUnavailable")}</div>
                      )}
                      <div className="muted" style={{ marginTop: 6, fontFamily: "monospace" }}>
                        {img.storage_path}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="section">
            <h2 style={{ fontSize: 16, margin: 0 }}>{tc("reports.chrome.html.summaryHeading")}</h2>
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140, border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "#f8f8f8" }}>
                <div style={{ fontSize: 11, color: "#555" }}>{tc("reports.chrome.html.overallScore")}</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
                  {summary.score ?? "—"}
                </div>
              </div>
              <div style={{ flex: 2, minWidth: 200, border: "1px solid #ddd", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#555" }}>{tc("reports.chrome.html.donorQualityLabel")}</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{summary.donor_quality ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#555" }}>{tc("reports.chrome.html.graftSurvivalLabel")}</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{summary.graft_survival_estimate ?? "—"}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#555" }}>{tc("reports.chrome.html.notesLabel")}</div>
                <div style={{ marginTop: 4 }}>{summary.notes ?? "—"}</div>
              </div>
            </div>
            {findings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#555" }}>{tc("reports.chrome.html.keyFindingsLabel")}</div>
                <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                  {findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {forensic && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#555" }}>{tc("reports.chrome.html.forensicAuditHeading")}</div>
                <table style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>{tc("reports.chrome.html.tableColItem")}</th>
                      <th>{tc("reports.chrome.html.tableColAssessment")}</th>
                      <th>{tc("reports.chrome.html.tableColEvidence")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{tc("reports.chrome.html.rowOverall")}</td>
                      <td>
                        {tc("reports.chrome.html.scorePrefix")} {forensic.overall_score ?? summary.score ?? "—"}{" "}
                        {forensic.confidence_label
                          ? `• ${tc("reports.chrome.html.confidencePrefix")} ${forensic.confidence_label}`
                          : ""}
                      </td>
                      <td>
                        {forensic.summary ? forensic.summary : <span className="muted">—</span>}
                      </td>
                    </tr>
                    <tr>
                      <td>{tc("reports.chrome.html.rowKeyFindings")}</td>
                      <td>
                        {Array.isArray(forensic.key_findings)
                          ? formatTemplate(tc("reports.chrome.html.itemsCount"), { count: forensic.key_findings.length })
                          : "—"}
                      </td>
                      <td>
                        {Array.isArray(forensic.key_findings) && forensic.key_findings.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {forensic.key_findings.slice(0, 6).map((f, i) => (
                              <li key={i}>
                                <strong>{f.title ?? tc("reports.chrome.html.findingFallback")}</strong>
                                {f.severity ? ` (${f.severity})` : ""}
                                {f.impact ? ` — ${f.impact}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>{tc("reports.chrome.html.rowRedFlags")}</td>
                      <td>
                        {Array.isArray(forensic.red_flags)
                          ? formatTemplate(tc("reports.chrome.html.itemsCount"), { count: forensic.red_flags.length })
                          : "—"}
                      </td>
                      <td>
                        {Array.isArray(forensic.red_flags) && forensic.red_flags.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {forensic.red_flags.slice(0, 6).map((f, i) => (
                              <li key={i}>
                                <strong>{f.flag ?? tc("reports.chrome.html.flagFallback")}</strong>
                                {f.why_it_matters ? ` — ${f.why_it_matters}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>{tc("reports.chrome.html.rowPhotoObservations")}</td>
                      <td>
                        {Array.isArray(forensic.photo_observations)
                          ? formatTemplate(tc("reports.chrome.html.photosCount"), {
                              count: forensic.photo_observations.length,
                            })
                          : "—"}
                      </td>
                      <td>
                        {Array.isArray(forensic.photo_observations) && forensic.photo_observations.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {forensic.photo_observations.slice(0, 6).map((p, i) => (
                              <li key={i}>
                                {p.suspected_view ? `${p.suspected_view}: ` : ""}
                                {Array.isArray(p.observations) && p.observations.length > 0 ? p.observations[0] : "—"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                    {isAuditorMode && Array.isArray(domainV1) && domainV1.length > 0 && (
                      <tr>
                        <td>{tc("reports.chrome.html.rowDomainsV1")}</td>
                        <td>
                          {benchmark?.eligible
                            ? tc("reports.chrome.html.benchmarkEligible")
                            : tc("reports.chrome.html.benchmarkNotEligible")}
                          {benchmark?.gate_version
                            ? ` • ${tc("reports.chrome.html.gatePrefix")} ${benchmark.gate_version}`
                            : ""}
                        </td>
                        <td>
                          {(forensic as any)?.overall_scores_v1 && (
                            <div style={{ marginBottom: 10 }}>
                              <div>
                                <strong>{tc("reports.chrome.html.performanceScoreLabel")}</strong>{" "}
                                {(forensic as any).overall_scores_v1?.performance_score ?? "—"}
                              </div>
                              <div>
                                <strong>{tc("reports.chrome.html.confidenceGradeLabel")}</strong>{" "}
                                {(forensic as any).overall_scores_v1?.confidence_grade ?? "—"}{" "}
                                {typeof (forensic as any).overall_scores_v1?.confidence_multiplier === "number"
                                  ? `(${(forensic as any).overall_scores_v1.confidence_multiplier.toFixed(2)})`
                                  : ""}
                              </div>
                              <div>
                                <strong>{tc("reports.chrome.html.benchmarkScoreLabel")}</strong>{" "}
                                {(forensic as any).overall_scores_v1?.benchmark_score ?? "—"}
                              </div>
                            </div>
                          )}
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th>{tc("reports.chrome.html.domainColDomain")}</th>
                                <th>{tc("reports.chrome.html.domainColRaw")}</th>
                                <th>{tc("reports.chrome.html.domainColConf")}</th>
                                <th>{tc("reports.chrome.html.domainColGrade")}</th>
                                <th>{tc("reports.chrome.html.domainColWeighted")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {domainV1.slice(0, 10).map((d, i) => (
                                <tr key={i}>
                                  <td><strong>{d.domain_id}</strong> — {d.title ?? ""}</td>
                                  <td>{d.raw_score ?? "—"}</td>
                                  <td>{typeof d.confidence === "number" ? `${Math.round(d.confidence * 100)}%` : "—"}</td>
                                  <td>{d.evidence_grade ?? "—"}</td>
                                  <td>{d.weighted_score ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {Array.isArray(benchmark?.reasons) && benchmark!.reasons!.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div className="muted">{tc("reports.chrome.html.eligibilityReasons")}</div>
                              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                                {benchmark!.reasons!.slice(0, 6).map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray((forensic as any)?.tiers_v1) && (forensic as any).tiers_v1.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div className="muted">{tc("reports.chrome.html.tierV1")}</div>
                              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                                {(forensic as any).tiers_v1.slice(0, 3).map((t: any, idx: number) => (
                                  <li key={idx}>
                                    <strong>{t.title}</strong>: {t.eligible ? tc("reports.chrome.html.tierEligible") : tc("reports.chrome.html.tierNotYet")}{" "}
                                    {Array.isArray(t.reasons) && t.reasons.length ? `— ${t.reasons[0]}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    {isAuditorMode && (forensic as any)?.completeness_index_v1 && (
                      <tr>
                        <td>{tc("reports.chrome.html.rowCompletenessV1")}</td>
                        <td>{(forensic as any).completeness_index_v1?.score ?? "—"} / 100</td>
                        <td>
                          <div className="muted">{tc("reports.chrome.html.completenessBasedOnDocs")}</div>
                          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                            <li>
                              {tc("reports.chrome.html.completenessPhotos")}{" "}
                              {(forensic as any).completeness_index_v1?.breakdown?.photo_coverage?.score ?? "—"} / 45
                            </li>
                            <li>
                              {tc("reports.chrome.html.completenessStructured")}{" "}
                              {(forensic as any).completeness_index_v1?.breakdown?.structured_metadata?.score ?? "—"} / 35
                            </li>
                            <li>
                              {tc("reports.chrome.html.completenessNumeric")}{" "}
                              {(forensic as any).completeness_index_v1?.breakdown?.numeric_precision?.score ?? "—"} / 10
                            </li>
                            <li>
                              {tc("reports.chrome.html.completenessVerification")}{" "}
                              {(forensic as any).completeness_index_v1?.breakdown?.verification_evidence?.score ?? "—"} / 10
                            </li>
                          </ul>
                        </td>
                      </tr>
                    )}
                    {Array.isArray(forensic.data_quality?.limitations) && forensic.data_quality!.limitations!.length > 0 && (
                      <tr>
                        <td>{tc("reports.chrome.html.rowLimitations")}</td>
                        <td colSpan={2}>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {forensic.data_quality!.limitations!.slice(0, 12).map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {sessionRole === "auditor" && imageEvidenceQualityForReport && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  border: "1px solid #dde3ea",
                  borderRadius: 10,
                  background: "#f4f6f9",
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 11, color: "#555", marginBottom: 8, fontWeight: 600 }}>
                  Image evidence sufficiency (informational — not scored)
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: "#666", lineHeight: 1.45 }}>
                  Patient-submitted photo group coverage for review and debugging. Does not change scores, weights, or eligibility.
                </p>
                <div style={{ marginBottom: 10, color: "#444" }}>
                  <strong>Overall summary:</strong> {imageEvidenceQualityForReport.overall.summaryLevel}
                  {" · "}
                  <strong>Extended optional categories:</strong>{" "}
                  {imageEvidenceQualityForReport.overall.hasExtendedEvidence ? "yes" : "no"}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: 6,
                          textAlign: "left",
                          background: "#e8ebf0",
                        }}
                      >
                        Group
                      </th>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: 6,
                          textAlign: "left",
                          background: "#e8ebf0",
                        }}
                      >
                        Level
                      </th>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: 6,
                          textAlign: "left",
                          background: "#e8ebf0",
                        }}
                      >
                        Rationale
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PATIENT_IMAGE_EVIDENCE_QUALITY_GROUP_ORDER.map((id) => {
                      const g = imageEvidenceQualityForReport.groups[id];
                      return (
                        <tr key={id}>
                          <td style={{ border: "1px solid #ddd", padding: 6, verticalAlign: "top" }}>
                            {PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS[id]}
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: 6,
                              verticalAlign: "top",
                              textTransform: "capitalize",
                            }}
                          >
                            {g.level}
                            {g.count > 0 ? ` (n=${g.count})` : ""}
                          </td>
                          <td style={{ border: "1px solid #ddd", padding: 6, verticalAlign: "top", color: "#555" }}>
                            {g.rationale}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* Auditor change summary and per-domain notes — only report-visible overrides/feedback */}
            {hasReportVisibleOverrides && auditorChangeSummaryLines.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 10, background: "#fafafa" }}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>{tc("reports.chrome.html.auditorChangeSummary")}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {auditorChangeSummaryLines.map((line, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(domainV1) && domainV1.length > 0 && (() => {
              const domainNotes = domainV1
                .map((d) => ({ domainId: d.domain_id as string, title: d.title, note: buildAuditorNoteForDomain(d.domain_id as string, reportVisibleOverrides, reportVisibleFeedback) }))
                .filter((x) => x.note.length > 0);
              return domainNotes.length > 0 ? (
                <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 10, background: "#fafafa" }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>{tc("reports.chrome.html.auditorNotesHeading")}</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {domainNotes.map((x, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        <strong>{x.title ?? x.domainId}</strong>: {x.note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            {(domains || sections) &&
              (Object.keys(domains ?? {}).length > 0 || Object.keys(sections ?? {}).length > 0) && (
              <div style={{ marginTop: 16 }}>
                <ScoreAreaGraph
                  domains={domainsSafe as Record<string, number> | undefined}
                  sections={sectionsSafe as Record<string, number> | undefined}
                  domainTitles={domainTitles}
                  sectionTitles={sectionTitles}
                  compact
                />
              </div>
            )}
          </div>

          <div className="footer">
            {tc("reports.chrome.html.footerLine1")}
            <br />
            {tc("reports.chrome.html.footerLine2")}
          </div>
        </div>
      </body>
    </html>
  );
}
