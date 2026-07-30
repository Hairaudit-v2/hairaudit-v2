/**
 * HA-PATIENT-REPORT-UI-1A — generate static visual QA HTML + Playwright screenshots.
 * Usage: pnpm exec tsx scripts/patient-report-ui-1a-visual-qa.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { buildAutomatedDonorHealingOrientation, toPatientSafeDonorOrientationSlice } from "../src/lib/patient/donorHealingOrientationReport";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { buildDonorHealingPatientReportViewModel } from "../src/lib/patientReport/adapters/donorHealingReportAdapter";
import { DONOR_HEALING_ORIENTATION_LABELS } from "../src/lib/patient/donorHealingEntry";

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp");

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildFixtureReport() {
  const answers = {
    entry_context: "donor_healing",
    months_since: "6_9",
    procedure_date: "2025-01-15",
    appearance_trend: "stable",
  };
  const uploadTypes = [
    "patient_photo:preop_donor_rear",
    "patient_photo:preop_donor_left",
    "patient_photo:preop_donor_right",
  ];
  const record = buildAutomatedDonorHealingOrientation({ answers, uploadTypes });
  const summary = {
    entry_context: "donor_healing",
    primary_donor_concern: "donor_patchiness",
    patient_answers: answers,
    donor_healing_orientation: record,
    forensic_audit: {
      key_findings: [{ title: "Donor appearance broadly compatible", severity: "low" }],
    },
  };
  const report = generatePostSurgeryAuditReport({
    summary,
    caseId: "visual-qa-case",
    reportVersion: 1,
    patientReviewPathway: "post_surgery",
    uploadTypes,
    patientAuditV2: { answers },
  });
  report.donorHealingOrientation = toPatientSafeDonorOrientationSlice(record!);
  return report;
}

function renderHtml(opts: { expandedPhoto?: boolean; supportingOpen?: boolean; professional?: boolean }): string {
  const report = buildFixtureReport();
  const vm = buildDonorHealingPatientReportViewModel({
    report,
    statusLabel: "Complete",
    reportDate: "2026-07-30",
    procedureDate: "2025-01-15",
    monthsSinceBand: "6_9",
    uploads: [
      { id: "p1", type: "patient_photo:preop_donor_rear" },
      { id: "p2", type: "patient_photo:preop_donor_left" },
      { id: "p3", type: "patient_photo:preop_donor_right" },
    ],
  });

  const findings = vm.sections.find((s) => s.type === "findings");
  const photos = vm.sections.find((s) => s.type === "photos");
  const next = vm.sections.find((s) => s.type === "recommendations");
  const limits = vm.sections.find((s) => s.type === "limitations");

  const photoCards =
    photos && photos.type === "photos"
      ? photos.groups
          .map(
            (g) => `
        <div class="group">
          <h4>${esc(g.title)}</h4>
          <div class="photo-grid">
            ${g.photos
              .map(
                (p) => `
              <button class="photo-card" type="button" data-testid="qa-photo">
                <div class="photo-frame">${esc(p.label)}</div>
                <div class="photo-meta">${esc(p.label)}</div>
              </button>`
              )
              .join("")}
          </div>
        </div>`
          )
          .join("")
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>HA-PATIENT-REPORT-UI-1A Visual QA</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #e8ecf1; color: #0f172a; }
  .shell { max-width: 72rem; margin: 1.5rem auto; background: #f7f8fa; border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; }
  header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 1.25rem 1.5rem; }
  .brand { font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; font-family: system-ui, sans-serif; font-weight: 700; }
  h1 { margin: 0.4rem 0 0; font-size: 1.75rem; }
  .meta { margin-top: 0.6rem; font-size: 0.9rem; color: #475569; font-family: system-ui, sans-serif; }
  .content { padding: 1.5rem; display: grid; gap: 1.5rem; }
  .summary { border: 1px solid #a7f3d0; background: #ecfdf5; border-radius: 1rem; padding: 1.25rem; }
  .summary .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #047857; font-family: system-ui, sans-serif; font-weight: 700; }
  .summary h2 { margin: 0.5rem 0 0; font-size: 1.4rem; }
  .status { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .status li { list-style: none; border: 1px solid #bae6fd; background: #f0f9ff; border-radius: 0.75rem; padding: 0.85rem; font-family: system-ui, sans-serif; }
  .status .k { font-size: 0.65rem; text-transform: uppercase; color: #0369a1; font-weight: 700; }
  .status .v { margin-top: 0.35rem; font-size: 0.9rem; font-weight: 600; }
  .means { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .means article { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; font-family: system-ui, sans-serif; font-size: 0.9rem; }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .photo-card { border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; background: #fff; padding: 0; cursor: pointer; text-align: left; }
  .photo-frame { aspect-ratio: 4/3; background: linear-gradient(135deg, #cbd5e1, #94a3b8); display: flex; align-items: center; justify-content: center; color: #334155; font-family: system-ui, sans-serif; font-size: 0.85rem; }
  .photo-meta { padding: 0.6rem 0.75rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-family: system-ui, sans-serif; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; font-family: system-ui, sans-serif; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.75rem 1rem; border-top: 1px solid #f1f5f9; vertical-align: top; }
  th { background: #f8fafc; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .next { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.75rem; padding: 1rem; font-family: system-ui, sans-serif; }
  .limits { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; color: #475569; font-family: system-ui, sans-serif; font-size: 0.9rem; }
  details { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem; font-family: system-ui, sans-serif; }
  .lightbox { position: fixed; inset: 0; background: rgba(15,23,42,0.8); display: ${opts.expandedPhoto ? "flex" : "none"}; align-items: center; justify-content: center; }
  .lightbox .panel { background: #fff; border-radius: 1rem; padding: 1rem; width: min(48rem, 92vw); }
  .lightbox .big { aspect-ratio: 4/3; background: linear-gradient(135deg, #94a3b8, #64748b); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: #fff; font-family: system-ui, sans-serif; }
  .pro { margin: 1.5rem auto; max-width: 72rem; background: #020617; color: #e2e8f0; border-radius: 1rem; padding: 1.25rem; border: 1px solid #164e63; font-family: system-ui, sans-serif; display: ${opts.professional ? "block" : "none"}; }
  .pro button { margin-right: 0.5rem; margin-top: 0.75rem; background: #083344; color: #a5f3fc; border: 1px solid #155e75; border-radius: 0.4rem; padding: 0.4rem 0.75rem; }
  @media (max-width: 700px) {
    .status, .means, .photo-grid { grid-template-columns: 1fr; }
  }
  @media print {
    .pro, .no-print { display: none !important; }
    body { background: #fff; }
    .shell { border: none; }
  }
</style>
</head>
<body>
  <article class="shell" data-testid="patient-report-shell">
    <header>
      <div class="brand">HairAudit</div>
      <div class="meta">Post-Surgery Audit · Donor healing</div>
      <h1>${esc(vm.reportTitle)}</h1>
      <div class="meta">Report date Jul 30, 2026 · Procedure date Jan 15, 2025 · Status Complete</div>
    </header>
    <div class="content">
      <div class="summary" data-testid="patient-report-summary">
        <div class="label">${esc(vm.summary.label)}</div>
        <h2>${esc(vm.summary.title)}</h2>
        <p>${esc(vm.summary.narrative)}</p>
      </div>
      <ul class="status" data-testid="patient-report-status-strip">
        ${vm.statusItems
          .map(
            (i) => `<li><div class="k">${esc(i.label)}</div><div class="v">${esc(i.value)}</div></li>`
          )
          .join("")}
      </ul>
      <section>
        <h3>What this means</h3>
        <div class="means">
          <article><strong>What the photographs support</strong><p>${esc(
            (vm.sections.find((s) => s.type === "narrative") as { whatThisMeans: { photographsSupport: string[] } })
              ?.whatThisMeans.photographsSupport[0] ?? ""
          )}</p></article>
          <article><strong>What remains uncertain</strong><p>Exact donor density cannot be measured from photographs.</p></article>
          <article><strong>Recommended next step</strong><p>${esc(
            (vm.sections.find((s) => s.type === "narrative") as { whatThisMeans: { recommendedNextStep: string } })
              ?.whatThisMeans.recommendedNextStep ?? ""
          )}</p></article>
        </div>
      </section>
      <section data-testid="patient-report-photo-gallery">
        <h3>Donor photographs</h3>
        ${photoCards}
      </section>
      <section>
        <h3>Observed donor features</h3>
        <table data-testid="patient-report-findings">
          <thead><tr><th>Domain</th><th>Observation</th><th>Evidence strength</th></tr></thead>
          <tbody>
            ${
              findings && findings.type === "findings"
                ? findings.rows
                    .map(
                      (r) =>
                        `<tr><td>${esc(r.domain)}</td><td>${esc(r.observation)}</td><td>${esc(
                          r.evidenceStrength
                        )}</td></tr>`
                    )
                    .join("")
                : ""
            }
          </tbody>
        </table>
      </section>
      <section class="limits" data-testid="patient-report-limitations">
        <h3>Evidence limitations</h3>
        <ul>
          ${
            limits && limits.type === "limitations"
              ? limits.items.map((i) => `<li>${esc(i)}</li>`).join("")
              : ""
          }
        </ul>
      </section>
      <section class="next" data-testid="patient-report-next-steps">
        <h3>Recommended next steps</h3>
        <ul>
          ${
            next && next.type === "recommendations"
              ? next.steps.map((s) => `<li>${esc(s.label)}</li>`).join("")
              : ""
          }
        </ul>
      </section>
      <details ${opts.supportingOpen ? "open" : ""} data-testid="patient-report-disclosure-supporting_detail">
        <summary>Supporting evidence</summary>
        <p>Procedural assessment scores and methodology are available here. Technical radar charts are not used as the primary conclusion.</p>
        <p>Orientation label source: ${esc(DONOR_HEALING_ORIENTATION_LABELS.compatible_with_reported_stage)}</p>
      </details>
    </div>
  </article>

  <aside class="pro" data-testid="professional-donor-orientation-workspace">
    <div class="brand" style="color:#67e8f9">Professional workspace</div>
    <p>Prepare, Confirm, and Correct remain outside the patient report.</p>
    <button type="button">Prepare</button>
    <button type="button">Confirm</button>
    <button type="button">Correct</button>
  </aside>

  <div class="lightbox" data-testid="patient-report-photo-lightbox">
    <div class="panel">
      <strong>Rear donor view</strong>
      <div class="big">Expanded donor photograph</div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  const variants: Array<{
    file: string;
    shot: string;
    opts: { expandedPhoto?: boolean; supportingOpen?: boolean; professional?: boolean };
    viewport: { width: number; height: number };
  }> = [
    {
      file: "patient-report-ui-1a-visual-qa.html",
      shot: "patient-report-ui-1a-donor-desktop.png",
      opts: {},
      viewport: { width: 1440, height: 1800 },
    },
    {
      file: "patient-report-ui-1a-visual-qa-mobile.html",
      shot: "patient-report-ui-1a-donor-mobile.png",
      opts: {},
      viewport: { width: 390, height: 1600 },
    },
    {
      file: "patient-report-ui-1a-visual-qa-photo.html",
      shot: "patient-report-ui-1a-donor-expanded-photo.png",
      opts: { expandedPhoto: true },
      viewport: { width: 1280, height: 900 },
    },
    {
      file: "patient-report-ui-1a-visual-qa-supporting.html",
      shot: "patient-report-ui-1a-donor-supporting-detail.png",
      opts: { supportingOpen: true },
      viewport: { width: 1280, height: 1600 },
    },
    {
      file: "patient-report-ui-1a-visual-qa-print.html",
      shot: "patient-report-ui-1a-print-preview.png",
      opts: {},
      viewport: { width: 1024, height: 1400 },
    },
    {
      file: "patient-report-ui-1a-visual-qa-pro.html",
      shot: "patient-report-ui-1a-professional-separation.png",
      opts: { professional: true },
      viewport: { width: 1280, height: 1600 },
    },
  ];

  const browser = await chromium.launch();
  try {
    for (const v of variants) {
      const htmlPath = path.join(TMP, v.file);
      fs.writeFileSync(htmlPath, renderHtml(v.opts), "utf8");
      const page = await browser.newPage({ viewport: v.viewport });
      await page.goto(`file://${htmlPath.replaceAll("\\", "/")}`);
      if (v.shot.includes("print")) {
        await page.emulateMedia({ media: "print" });
      }
      await page.screenshot({
        path: path.join(TMP, v.shot),
        fullPage: true,
      });
      await page.close();
      console.log("wrote", v.shot);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
