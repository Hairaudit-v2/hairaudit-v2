/**
 * HA-PATIENT-REPORT-UI-1B — generate static visual QA HTML + Playwright screenshots.
 * Usage: pnpm exec tsx scripts/patient-report-ui-1b-visual-qa.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { buildPostSurgeryAuditPatientReportViewModel } from "../src/lib/patientReport/adapters/postSurgeryAuditReportAdapter";
import { buildDonorHealingPatientReportViewModel } from "../src/lib/patientReport/adapters/donorHealingReportAdapter";
import {
  buildAutomatedDonorHealingOrientation,
  toPatientSafeDonorOrientationSlice,
} from "../src/lib/patient/donorHealingOrientationReport";
import type { PatientReportViewModel } from "../src/lib/patientReport/types";

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp", "patient-report-ui-1b");

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildStandardReport(opts?: {
  monthsSince?: string;
  procedureDate?: string | null;
  outcomeHint?: "strong" | "density" | "donor" | "early" | "partial";
}) {
  const monthsSince = opts?.monthsSince ?? (opts?.outcomeHint === "early" ? "under_3" : "6_9");
  const procedureDate =
    opts?.procedureDate === null ? undefined : (opts?.procedureDate ?? "2024-08-12");
  const answers: Record<string, unknown> = {
    months_since: monthsSince,
    ...(procedureDate ? { procedure_date: procedureDate } : {}),
    density_satisfaction: opts?.outcomeHint === "density" || opts?.outcomeHint === "partial" ? 2 : 5,
    donor_appearance: opts?.outcomeHint === "donor" ? 1 : 5,
  };
  const forensic =
    opts?.outcomeHint === "early"
      ? {
          overallScore: 60,
          key_findings: [
            { title: "Early-stage result — density assessment remains preliminary", severity: "low" },
          ],
        }
      : opts?.outcomeHint === "partial"
        ? {
            overallScore: 55,
            key_findings: [{ title: "Limited photographic evidence available", severity: "medium" }],
          }
        : opts?.outcomeHint === "donor"
          ? {
              overallScore: 52,
              key_findings: [
                { title: "Donor irregularity visible on submitted views", severity: "high" },
              ],
            }
          : {
              overallScore: 86,
              key_findings: [
                { title: "Recipient density distribution appears consistent", severity: "low" },
                { title: "Donor region shows acceptable preservation", severity: "low" },
              ],
              sectionScores: {
                donor_management: 84,
                density_distribution: 87,
                recipient_placement: 85,
              },
            };

  const uploadTypes =
    opts?.outcomeHint === "partial"
      ? (["patient_photo:preop_front"] as const)
      : ([
          "patient_photo:preop_front",
          "patient_photo:preop_donor_rear",
          "patient_photo:preop_donor_left",
          "patient_photo:preop_donor_right",
          "patient_photo:current_recipient_closeup",
        ] as const);

  const report = generatePostSurgeryAuditReport({
    summary: { patient_answers: answers, forensic_audit: forensic },
    caseId: "visual-qa-1b",
    reportVersion: 1,
    patientReviewPathway: "post_surgery",
    uploadTypes,
    patientAuditV2: { answers },
  });
  report.donorHealingOrientation = null;
  return { report, monthsSince, procedureDate: procedureDate ?? null, uploadTypes };
}

function buildDonorVm() {
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
  ] as const;
  const record = buildAutomatedDonorHealingOrientation({ answers, uploadTypes });
  const report = generatePostSurgeryAuditReport({
    summary: {
      entry_context: "donor_healing",
      primary_donor_concern: "donor_patchiness",
      patient_answers: answers,
      donor_healing_orientation: record,
      forensic_audit: {
        key_findings: [{ title: "Donor appearance broadly compatible", severity: "low" }],
      },
    },
    caseId: "visual-qa-1b-donor",
    reportVersion: 1,
    patientReviewPathway: "post_surgery",
    uploadTypes,
    patientAuditV2: { answers },
  });
  report.donorHealingOrientation = toPatientSafeDonorOrientationSlice(record!);
  return buildDonorHealingPatientReportViewModel({
    report,
    statusLabel: "Complete",
    monthsSinceBand: "6_9",
    procedureDate: "2025-01-15",
    uploads: uploadTypes.map((type, i) => ({ id: `d${i}`, type })),
  });
}

function renderHtml(
  vm: PatientReportViewModel,
  opts: {
    expandedPhoto?: boolean;
    supportingOpen?: boolean;
    professional?: boolean;
    print?: boolean;
  }
): string {
  const findings = vm.sections.find((s) => s.type === "findings" && s.id === "findings");
  const photos = vm.sections.find((s) => s.type === "photos");
  const next = vm.sections.find((s) => s.type === "recommendations");
  const limits = vm.sections.find((s) => s.type === "limitations");
  const timeline = vm.sections.find((s) => s.type === "timeline");

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
              <button class="photo-card" type="button">
                <div class="photo-frame">${esc(p.label)}</div>
                <div class="photo-meta">${esc(p.label)}</div>
              </button>`
              )
              .join("")}
          </div>
        </div>`
          )
          .join("")
      : "<p class=\"muted\">No photographs in this fixture.</p>";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>HA-PATIENT-REPORT-UI-1B Visual QA</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #e8ecf1; color: #0f172a; }
  .shell { max-width: 72rem; margin: 1.5rem auto; background: #f7f8fa; border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; }
  header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 1.25rem 1.5rem; }
  .brand { font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; font-family: system-ui, sans-serif; font-weight: 700; }
  h1 { margin: 0.4rem 0 0; font-size: 1.75rem; }
  .meta { margin-top: 0.6rem; font-size: 0.9rem; color: #475569; font-family: system-ui, sans-serif; }
  .content { padding: 1.5rem; display: grid; gap: 1.5rem; }
  .summary { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 1rem; padding: 1.25rem; }
  .summary .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #1d4ed8; font-family: system-ui, sans-serif; font-weight: 700; }
  .summary h2 { margin: 0.5rem 0 0; font-size: 1.4rem; }
  .status { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin: 0; padding: 0; }
  .status li { list-style: none; border: 1px solid #bae6fd; background: #f0f9ff; border-radius: 0.75rem; padding: 0.85rem; font-family: system-ui, sans-serif; }
  .status .k { font-size: 0.65rem; text-transform: uppercase; color: #0369a1; font-weight: 700; }
  .status .v { margin-top: 0.35rem; font-size: 0.9rem; font-weight: 600; }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .photo-card { border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; background: #fff; padding: 0; text-align: left; }
  .photo-frame { aspect-ratio: 4/3; background: linear-gradient(135deg, #cbd5e1, #94a3b8); display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; font-size: 0.85rem; }
  .photo-meta { padding: 0.6rem 0.75rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-family: system-ui, sans-serif; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; font-family: system-ui, sans-serif; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.75rem 1rem; border-top: 1px solid #f1f5f9; vertical-align: top; }
  th { background: #f8fafc; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .next { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.75rem; padding: 1rem; font-family: system-ui, sans-serif; }
  .limits { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; color: #475569; font-family: system-ui, sans-serif; font-size: 0.9rem; }
  .timeline { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; font-family: system-ui, sans-serif; }
  details { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem; font-family: system-ui, sans-serif; }
  .muted { color: #64748b; font-family: system-ui, sans-serif; }
  .nav { font-family: system-ui, sans-serif; font-size: 0.85rem; padding: 0.5rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: #fff; }
  .lightbox { position: fixed; inset: 0; background: rgba(15,23,42,0.8); display: ${opts.expandedPhoto ? "flex" : "none"}; align-items: center; justify-content: center; }
  .lightbox .panel { background: #fff; border-radius: 1rem; padding: 1rem; width: min(48rem, 92vw); }
  .lightbox .big { aspect-ratio: 4/3; background: linear-gradient(135deg, #94a3b8, #64748b); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: #fff; font-family: system-ui, sans-serif; }
  .pro { margin: 1.5rem auto; max-width: 72rem; background: #020617; color: #e2e8f0; border-radius: 1rem; padding: 1.25rem; border: 1px solid #164e63; font-family: system-ui, sans-serif; display: ${opts.professional ? "block" : "none"}; }
  .pro button { margin-right: 0.5rem; margin-top: 0.75rem; background: #083344; color: #a5f3fc; border: 1px solid #155e75; border-radius: 0.4rem; padding: 0.4rem 0.75rem; }
  @media (max-width: 700px) { .status, .photo-grid { grid-template-columns: 1fr; } }
  @media print {
    .pro, .nav { display: none !important; }
    body { background: #fff; }
    .shell { border: none; box-shadow: none; }
  }
</style>
</head>
<body class="${opts.print ? "print-preview" : ""}">
  <article class="shell" data-testid="patient-report-shell" data-report-type="${esc(vm.reportType)}">
    <header>
      <div class="brand">HairAudit</div>
      <div class="meta">${esc(vm.reportSubtitle ?? "Independent case review")}</div>
      <h1>${esc(vm.reportTitle)}</h1>
      <div class="meta">Status Complete</div>
    </header>
    <nav class="nav" data-testid="patient-report-navigation">Summary · Findings · Photographs · Limitations · Next steps</nav>
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
      <section data-testid="patient-report-photo-gallery">
        <h3>Photographic evidence</h3>
        ${photoCards}
      </section>
      <section>
        <h3>Key findings</h3>
        <table data-testid="patient-report-findings">
          <thead><tr><th>Domain</th><th>Finding</th><th>Evidence strength</th></tr></thead>
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
      ${
        timeline && timeline.type === "timeline"
          ? `<section class="timeline" data-testid="patient-report-timeline">
              <h3>${esc(timeline.title)}</h3>
              ${timeline.items
                .map((i) => `<p><strong>${esc(i.title)}</strong> — ${esc(i.body)}</p>`)
                .join("")}
            </section>`
          : ""
      }
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
        <p>Score detail, methodology, and secondary notes live here — not in the first viewport.</p>
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

  <div class="lightbox">
    <div class="panel">
      <strong>Expanded photograph</strong>
      <div class="big">Patient-usable expanded view</div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  const mature = buildStandardReport({ outcomeHint: "strong" });
  const matureVm = buildPostSurgeryAuditPatientReportViewModel({
    report: mature.report,
    statusLabel: "Complete",
    monthsSinceBand: mature.monthsSince,
    procedureDate: mature.procedureDate,
    uploads: mature.uploadTypes.map((type, i) => ({ id: `p${i}`, type })),
  });

  const early = buildStandardReport({ outcomeHint: "early", monthsSince: "under_3" });
  const earlyVm = buildPostSurgeryAuditPatientReportViewModel({
    report: early.report,
    monthsSinceBand: "under_3",
    procedureDate: early.procedureDate,
    uploads: early.uploadTypes.map((type, i) => ({ id: `e${i}`, type })),
  });

  const partial = buildStandardReport({ outcomeHint: "partial" });
  const partialVm = buildPostSurgeryAuditPatientReportViewModel({
    report: partial.report,
    monthsSinceBand: "6_9",
    procedureDate: partial.procedureDate,
    uploads: partial.uploadTypes.map((type, i) => ({ id: `x${i}`, type })),
  });

  const legacy = buildStandardReport({ procedureDate: null, monthsSince: undefined });
  const legacyVm = buildPostSurgeryAuditPatientReportViewModel({
    report: legacy.report,
    procedureDate: null,
    monthsSinceBand: null,
    uploads: [],
  });

  const donorVm = buildDonorVm();

  const variants: Array<{
    file: string;
    shot: string;
    html: string;
    viewport: { width: number; height: number };
    emulatePrint?: boolean;
  }> = [
    {
      file: "standard.html",
      shot: "standard-post-surgery-desktop.png",
      html: renderHtml(matureVm, {}),
      viewport: { width: 1440, height: 1800 },
    },
    {
      file: "standard-mobile.html",
      shot: "standard-post-surgery-mobile.png",
      html: renderHtml(matureVm, {}),
      viewport: { width: 390, height: 1600 },
    },
    {
      file: "photo-expanded.html",
      shot: "standard-post-surgery-photo-expanded.png",
      html: renderHtml(matureVm, { expandedPhoto: true }),
      viewport: { width: 1280, height: 1200 },
    },
    {
      file: "supporting.html",
      shot: "standard-post-surgery-supporting-detail.png",
      html: renderHtml(matureVm, { supportingOpen: true }),
      viewport: { width: 1280, height: 1600 },
    },
    {
      file: "early.html",
      shot: "standard-post-surgery-early-stage.png",
      html: renderHtml(earlyVm, {}),
      viewport: { width: 1280, height: 1600 },
    },
    {
      file: "partial.html",
      shot: "standard-post-surgery-partial-evidence.png",
      html: renderHtml(partialVm, {}),
      viewport: { width: 1280, height: 1400 },
    },
    {
      file: "legacy.html",
      shot: "standard-post-surgery-legacy.png",
      html: renderHtml(legacyVm, {}),
      viewport: { width: 1280, height: 1400 },
    },
    {
      file: "print.html",
      shot: "standard-post-surgery-print-preview.png",
      html: renderHtml(matureVm, { print: true }),
      viewport: { width: 1024, height: 1400 },
      emulatePrint: true,
    },
    {
      file: "professional.html",
      shot: "standard-post-surgery-professional-separation.png",
      html: renderHtml(matureVm, { professional: true }),
      viewport: { width: 1280, height: 1600 },
    },
    {
      file: "donor-regression.html",
      shot: "donor-regression.png",
      html: renderHtml(donorVm, {}),
      viewport: { width: 1280, height: 1600 },
    },
  ];

  const browser = await chromium.launch();
  for (const v of variants) {
    const htmlPath = path.join(TMP, v.file);
    fs.writeFileSync(htmlPath, v.html, "utf8");
    const page = await browser.newPage({ viewport: v.viewport });
    await page.goto(`file://${htmlPath.replaceAll("\\", "/")}`);
    if (v.emulatePrint) await page.emulateMedia({ media: "print" });
    await page.screenshot({
      path: path.join(TMP, v.shot),
      fullPage: true,
    });
    await page.close();
    console.log("wrote", v.shot);
  }
  await browser.close();
  console.log("HA-PATIENT-REPORT-UI-1B visual QA complete →", TMP);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
