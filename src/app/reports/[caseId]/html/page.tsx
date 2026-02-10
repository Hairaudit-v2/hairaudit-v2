import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

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
};

export default async function ReportHtmlPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{ token?: string }>;
}) {
  const { caseId } = await params;
  const sp = (await (searchParams ?? Promise.resolve({}))) as { token?: string };
  const token = sp?.token ?? "";

  const expected = process.env.REPORT_RENDER_TOKEN ?? "local";
  const allowToken = token === expected;

  // 🚫 For Playwright renders, NEVER use the cookie-based Supabase server client.
  // Use service role client only.
  if (!allowToken) {
    // For now, keep this route token-only to avoid cookie write errors.
    // If you want logged-in users to view this HTML in browser later,
    // we'll do it via a Route Handler instead.
    redirect("/login");
  }

  const supabase = createSupabaseAdmin();

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at")
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

  const summary = (latestReport?.summary ?? {}) as Summary;
  const findings = Array.isArray(summary.findings) ? summary.findings : (summary.highlights ?? []);

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
          </div>

          <div className="footer">
            HairAudit is an audit/reporting platform. This report is informational and not a medical diagnosis.
          </div>
        </div>
      </body>
    </html>
  );
}
