import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { parseRole } from "@/lib/roles";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import { scoreAudit } from "@/lib/audit/score";
import ScoreAreaGraph from "@/components/reports/ScoreAreaGraph";
import { buildRubricTitles } from "@/lib/audit/rubricTitles";
import { buildReportViewModel, normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";
import { resolveAuditModeFromCaseAccess } from "@/lib/reports/accessMode";
import { verifyRenderToken } from "@/lib/reports/internalRenderToken";

function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
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

  const supabase = createSupabaseAdmin();

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !c) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>Report</h1>
        <p>Case not found.</p>
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
    .select("id, type, storage_path, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (upErr) {
    console.error("uploads error:", upErr.message);
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

  const summary = (latestReport?.summary ?? {}) as Summary & {
    answers?: Record<string, Record<string, { value?: number | boolean | string }>>;
    audit_answers?: Record<string, Record<string, { value?: number | boolean | string }>>;
    scorecard_answers?: Record<string, Record<string, { value?: number | boolean | string }>>;
    computed?: { component_scores?: { domains?: Record<string, number>; sections?: Record<string, number> } };
    area_scores?: Record<string, number> | null;
    section_scores?: Record<string, number> | null;
  };
  const findings = Array.isArray(summary.findings) ? summary.findings : (summary.highlights ?? []);
  const forensic = summary.forensic_audit;
  const domainV1 = forensic?.domain_scores_v1?.domains ?? null;
  const benchmark = forensic?.benchmark ?? null;

  // Compute rubric score if answers exist (same as print route)
  let computed = summary?.computed ?? null;
  const answers = summary?.answers ?? summary?.audit_answers ?? summary?.scorecard_answers ?? null;
  if (answers) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      computed = scoreAudit(rubric as any, answers);
    } catch (e) {
      console.error("scoreAudit failed:", e);
    }
  }
  const comp = computed?.component_scores ?? {};
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
        domains: domainsSafe,
        sections: sectionsSafe,
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
        <title>HairAudit Report</title>
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
                <h1>HairAudit — Audit Report</h1>
                <div className="muted">Generated: {new Date().toLocaleString()}</div>
              </div>
            </div>
            <div className="muted" style={{ textAlign: "right" }}>
              Case ID<br />
              <span style={{ fontFamily: "monospace" }}>{caseId}</span>
            </div>
          </div>

          <div className="section">
            <div className="muted">Case title</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.title ?? "Untitled case"}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Status: {c.status} • Created: {new Date(c.created_at).toLocaleString()}
            </div>
          </div>

          <div className="section">
            <h2 style={{ fontSize: 16, margin: 0 }}>Uploads</h2>

            {(!uploads || uploads.length === 0) ? (
              <div className="muted" style={{ marginTop: 8 }}>No uploads attached.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Storage Path</th>
                    <th>Uploaded</th>
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
                <h3 style={{ fontSize: 14, marginTop: 14, marginBottom: 0 }}>Image gallery</h3>
                <div className="gallery">
                  {signedImages.map((img) => (
                    <div className="imgCard" key={img.id}>
                      {img.signedUrl ? (
                        <img src={img.signedUrl} alt={img.storage_path} />
                      ) : (
                        <div className="muted">Image URL unavailable</div>
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
            <h2 style={{ fontSize: 16, margin: 0 }}>Summary</h2>
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140, border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "#f8f8f8" }}>
                <div style={{ fontSize: 11, color: "#555" }}>Overall score</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
                  {summary.score ?? "—"}
                </div>
              </div>
              <div style={{ flex: 2, minWidth: 200, border: "1px solid #ddd", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#555" }}>Donor quality</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{summary.donor_quality ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#555" }}>Graft survival estimate</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{summary.graft_survival_estimate ?? "—"}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#555" }}>Notes</div>
                <div style={{ marginTop: 4 }}>{summary.notes ?? "—"}</div>
              </div>
            </div>
            {findings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#555" }}>Key findings</div>
                <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                  {findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {forensic && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#555" }}>Forensic audit (AI)</div>
                <table style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Assessment</th>
                      <th>Evidence / notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Overall</td>
                      <td>
                        Score: {forensic.overall_score ?? summary.score ?? "—"}{" "}
                        {forensic.confidence_label ? `• Confidence: ${forensic.confidence_label}` : ""}
                      </td>
                      <td>
                        {forensic.summary ? forensic.summary : <span className="muted">—</span>}
                      </td>
                    </tr>
                    <tr>
                      <td>Key findings</td>
                      <td>{Array.isArray(forensic.key_findings) ? `${forensic.key_findings.length} items` : "—"}</td>
                      <td>
                        {Array.isArray(forensic.key_findings) && forensic.key_findings.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {forensic.key_findings.slice(0, 6).map((f, i) => (
                              <li key={i}>
                                <strong>{f.title ?? "Finding"}</strong>
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
                      <td>Red flags</td>
                      <td>{Array.isArray(forensic.red_flags) ? `${forensic.red_flags.length} items` : "—"}</td>
                      <td>
                        {Array.isArray(forensic.red_flags) && forensic.red_flags.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {forensic.red_flags.slice(0, 6).map((f, i) => (
                              <li key={i}>
                                <strong>{f.flag ?? "Flag"}</strong>
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
                      <td>Per-photo observations</td>
                      <td>{Array.isArray(forensic.photo_observations) ? `${forensic.photo_observations.length} photos` : "—"}</td>
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
                        <td>Domains (v1)</td>
                        <td>
                          {benchmark?.eligible ? "Benchmark eligible" : "Not benchmark eligible"}
                          {benchmark?.gate_version ? ` • Gate: ${benchmark.gate_version}` : ""}
                        </td>
                        <td>
                          {(forensic as any)?.overall_scores_v1 && (
                            <div style={{ marginBottom: 10 }}>
                              <div><strong>Performance Score:</strong> {(forensic as any).overall_scores_v1?.performance_score ?? "—"}</div>
                              <div><strong>Confidence:</strong> {(forensic as any).overall_scores_v1?.confidence_grade ?? "—"} {typeof (forensic as any).overall_scores_v1?.confidence_multiplier === "number" ? `(${(forensic as any).overall_scores_v1.confidence_multiplier.toFixed(2)})` : ""}</div>
                              <div><strong>Benchmark Score:</strong> {(forensic as any).overall_scores_v1?.benchmark_score ?? "—"}</div>
                            </div>
                          )}
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th>Domain</th>
                                <th>Raw</th>
                                <th>Conf</th>
                                <th>Grade</th>
                                <th>Weighted</th>
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
                              <div className="muted">Eligibility reasons</div>
                              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                                {benchmark!.reasons!.slice(0, 6).map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray((forensic as any)?.tiers_v1) && (forensic as any).tiers_v1.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div className="muted">Tier (v1)</div>
                              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                                {(forensic as any).tiers_v1.slice(0, 3).map((t: any, idx: number) => (
                                  <li key={idx}>
                                    <strong>{t.title}</strong>: {t.eligible ? "Eligible" : "Not yet"} {Array.isArray(t.reasons) && t.reasons.length ? `— ${t.reasons[0]}` : ""}
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
                        <td>Completeness index (v1)</td>
                        <td>{(forensic as any).completeness_index_v1?.score ?? "—"} / 100</td>
                        <td>
                          <div className="muted">Based on submitted documentation.</div>
                          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                            <li>Photos: {(forensic as any).completeness_index_v1?.breakdown?.photo_coverage?.score ?? "—"} / 45</li>
                            <li>Structured metadata: {(forensic as any).completeness_index_v1?.breakdown?.structured_metadata?.score ?? "—"} / 35</li>
                            <li>Numeric precision: {(forensic as any).completeness_index_v1?.breakdown?.numeric_precision?.score ?? "—"} / 10</li>
                            <li>Verification evidence: {(forensic as any).completeness_index_v1?.breakdown?.verification_evidence?.score ?? "—"} / 10</li>
                          </ul>
                        </td>
                      </tr>
                    )}
                    {Array.isArray(forensic.data_quality?.limitations) && forensic.data_quality!.limitations!.length > 0 && (
                      <tr>
                        <td>Limitations</td>
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
            {(domains || sections) &&
              (Object.keys(domains ?? {}).length > 0 || Object.keys(sections ?? {}).length > 0) && (
              <div style={{ marginTop: 16 }}>
                <ScoreAreaGraph
                  domains={domainsSafe}
                  sections={sectionsSafe}
                  domainTitles={domainTitles}
                  sectionTitles={sectionTitles}
                  compact
                />
              </div>
            )}
          </div>

          <div className="footer">
            HairAudit is an audit/reporting platform. This report is informational and not a medical diagnosis.
          </div>
        </div>
      </body>
    </html>
  );
}
