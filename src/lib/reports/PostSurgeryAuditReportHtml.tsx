import type { PostSurgeryAuditReport } from "./postSurgeryAuditReport";

export type PostSurgeryReportHtmlLabels = {
  heroTitle: string;
  heroSubtitle: string;
  outcomeLabel: string;
  proceduralOutcome: string;
  scorecardsTitle: string;
  scorecardsSubtitle: string;
  scorecardLabels: Record<string, string>;
  sectionTitles: Record<string, string>;
  sectionsTitle: string;
  concernsTitle: string;
  concernsSubtitle: string;
  concernSeverity: Record<string, string>;
  imagesTitle: string;
  imageViews: Record<string, string>;
  noPhoto: string;
  photoEmbedFailed: string;
  imageLimitedTitle: string;
  knownClinicalContextTitle: string;
  postOperativeTitle: string;
  postOperativeSubtitle: string;
  repairPlanningTitle: string;
  repairPlanningSubtitle: string;
  trustTitle: string;
  trustBody: string;
  trustNeutrality: string;
  nextStepsTitle: string;
  nextStepsSubtitle: string;
  repairLabel: string;
  repairState: string;
  reportIdLabel: string;
  generatedAtLabel: string;
  privacyStatement: string;
  footerLine: string;
};

export type PostSurgeryReportHtmlVm = {
  report: PostSurgeryAuditReport;
  caseId: string;
  labels: PostSurgeryReportHtmlLabels;
  generatedAtDisplay: string;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const SECTION_ORDER = [
  "overall_procedure",
  "donor_area",
  "extraction_pattern",
  "density_distribution",
  "recipient_area",
  "procedural_integrity",
  "long_term_risk",
  "repair_considerations",
] as const;

const SCORECARD_ORDER = [
  "donor_preservation",
  "extraction_pattern",
  "density_distribution",
  "recipient_area",
  "healing_quality",
  "repair_probability",
] as const;

export function renderPostSurgeryAuditReportHtml(vm: PostSurgeryReportHtmlVm): string {
  const { report, caseId, labels, generatedAtDisplay } = vm;
  const sectionById = new Map(report.sections.map((s) => [s.id, s]));
  const scorecardById = new Map(report.scorecards.map((s) => [s.id, s]));

  const scorecardsHtml = SCORECARD_ORDER
    .map((id) => {
      const card = scorecardById.get(id);
      if (!card) return "";
      const label = labels.scorecardLabels[id] ?? id;
      return `
        <div class="scoreCard">
          <div class="scoreLabel">${esc(label)}</div>
          <div class="scoreValue">${esc(card.displayValue)}</div>
        </div>`;
    })
    .join("");

  const sectionsHtml = SECTION_ORDER
    .map((id, index) => {
      const section = sectionById.get(id);
      if (!section) return "";
      const title = labels.sectionTitles[id] ?? id;
      return `
        <article class="reviewSection">
          <div class="sectionNum">${index + 1}</div>
          <div class="sectionBody">
            <h3>${esc(title)}</h3>
            <p>${esc(section.finding)}</p>
          </div>
        </article>`;
    })
    .join("");

  const concernsHtml =
    report.concernFlags.length > 0
      ? `
      <div class="section concernSection">
        <div class="sectionHead">
          <h2>${esc(labels.concernsTitle)}</h2>
        </div>
        <p class="sectionLead">${esc(labels.concernsSubtitle)}</p>
        <ul class="concernList">
          ${report.concernFlags
            .map(
              (f) => `
            <li class="concernItem">
              <span class="concernBadge">${esc(labels.concernSeverity[f.severity] ?? f.severity)}</span>
              <p>${esc(f.text)}</p>
            </li>`
            )
            .join("")}
        </ul>
      </div>`
      : "";

  const imagesHtml = report.imageAssessments
    .map((img) => {
      const viewLabel = labels.imageViews[img.viewKey] ?? img.viewKey;
      const imgTag = img.imageUrl
        ? `<img src="${esc(img.imageUrl)}" alt="${esc(img.imageLabel ?? viewLabel)}" class="patientPhoto" />`
        : `<div class="photoPlaceholder">${esc(labels.photoEmbedFailed)}</div>`;
      return `
        <div class="imageCard">
          ${imgTag}
          <div class="imageMeta">
            <div class="imageView">${esc(viewLabel)}</div>
            <p>${esc(img.assessment)}</p>
          </div>
        </div>`;
    })
    .join("");

  const nextStepsHtml = report.recommendedNextSteps
    .map((step) => `<li><span class="check">✓</span> ${esc(step)}</li>`)
    .join("");

  const imageLimitedHtml = report.patientSafeSummary.imageLimitedNotice
    ? `
    <div class="section imageLimitedSection">
      <div class="sectionHead"><h2>${esc(labels.imageLimitedTitle)}</h2></div>
      <p class="sectionLead">${esc(report.patientSafeSummary.imageLimitedNotice)}</p>
    </div>`
    : "";

  const clinicalContextLines = report.patientSafeSummary.knownClinicalContext ?? [];
  const clinicalContextHtml =
    clinicalContextLines.length > 0
      ? `
    <div class="section clinicalContextSection">
      <div class="sectionHead"><h2>${esc(labels.knownClinicalContextTitle)}</h2></div>
      <ul class="contextList">
        ${clinicalContextLines.map((line) => `<li>${esc(line)}</li>`).join("")}
      </ul>
    </div>`
      : "";

  const postOpSteps = report.postOperativeGuidance ?? [];
  const postOperativeHtml =
    postOpSteps.length > 0
      ? `
    <div class="section postOpSection">
      <div class="sectionHead"><h2>${esc(labels.postOperativeTitle)}</h2></div>
      <p class="sectionLead">${esc(labels.postOperativeSubtitle)}</p>
      <ul class="nextList">${postOpSteps.map((step) => `<li><span class="check">✓</span> ${esc(step)}</li>`).join("")}</ul>
    </div>`
      : "";

  const repairSteps = report.repairPlanningGuidance ?? [];
  const repairPlanningHtml =
    repairSteps.length > 0
      ? `
    <div class="section repairPlanningSection">
      <div class="sectionHead"><h2>${esc(labels.repairPlanningTitle)}</h2></div>
      <p class="sectionLead">${esc(labels.repairPlanningSubtitle)}</p>
      <ul class="nextList">${repairSteps.map((step) => `<li><span class="check">•</span> ${esc(step)}</li>`).join("")}</ul>
    </div>`
      : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>HairAudit Post-Surgery Review — ${esc(caseId)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    :root {
      --ink: #0b1a33;
      --muted: #4a5f7d;
      --line: #d5e2f2;
      --hero: #061a37;
      --gold: #c9a227;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      background: #f8fbff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.55;
    }
    .wrap { max-width: 880px; margin: 0 auto; }
    .hero {
      border-radius: 16px;
      padding: 28px;
      background: linear-gradient(135deg, #05172f 0%, #0f2f57 55%, #123a6b 100%);
      color: #f0f6ff;
      border: 1px solid rgba(180, 199, 230, 0.35);
      box-shadow: 0 24px 48px rgba(2, 12, 35, 0.2);
      page-break-inside: avoid;
    }
    .hero h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; }
    .heroLead { margin: 10px 0 0; color: #d8e6ff; max-width: 620px; font-size: 12px; }
    .outcomeBand {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.22);
      background: rgba(0,0,0,0.22);
    }
    .outcomeLabel { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.72); font-weight: 700; }
    .outcomeValue { margin-top: 6px; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
    .metaRow {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 10px;
      color: #c9d8ef;
    }
    .metaRow span { border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 4px 10px; }
    .section {
      margin-top: 22px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      page-break-inside: avoid;
    }
    .sectionHead h2 { margin: 0; font-size: 17px; letter-spacing: -0.01em; }
    .sectionLead { margin: 8px 0 0; color: var(--muted); font-size: 11px; }
    .scoreGrid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .scoreCard {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: linear-gradient(180deg, #f9fbff 0%, #fff 100%);
    }
    .scoreLabel { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
    .scoreValue { margin-top: 6px; font-size: 22px; font-weight: 800; color: var(--ink); }
    .reviewSection {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 10px;
      padding: 12px 0;
      border-bottom: 1px solid #edf2f9;
    }
    .reviewSection:last-child { border-bottom: none; }
    .sectionNum {
      width: 28px; height: 28px; border-radius: 999px;
      background: var(--ink); color: #fff; font-size: 11px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .sectionBody h3 { margin: 0; font-size: 12px; font-weight: 800; }
    .sectionBody p { margin: 6px 0 0; color: #334155; }
    .concernSection { border-color: #f0d7a0; background: #fffbeb; }
    .imageLimitedSection { border-color: #f59e0b; background: #fffbeb; border-width: 2px; }
    .imageLimitedSection .sectionHead h2 { color: #92400e; }
    .clinicalContextSection { background: #f8fafc; }
    .contextList { margin: 10px 0 0; padding-left: 18px; color: #334155; }
    .contextList li { margin-bottom: 6px; }
    .postOpSection { background: #f0f9ff; border-color: #bae6fd; }
    .repairPlanningSection { background: #faf5ff; border-color: #e9d5ff; }
    .concernList { list-style: none; margin: 12px 0 0; padding: 0; }
    .concernItem {
      border: 1px solid #f0d7a0;
      border-radius: 10px;
      background: #fff;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    .concernBadge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid #e8c468;
      background: #fef3c7;
      color: #7c4a03;
      border-radius: 999px;
      padding: 2px 8px;
      margin-bottom: 6px;
    }
    .imageGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .imageCard { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f8fafc; }
    .patientPhoto { width: 100%; height: 180px; object-fit: cover; display: block; }
    .photoPlaceholder {
      height: 180px; display: flex; align-items: center; justify-content: center;
      background: #e8eef7; color: var(--muted); font-size: 11px;
    }
    .imageMeta { padding: 10px 12px; }
    .imageView { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .trustBox { background: #f0f9ff; border-color: #bae6fd; }
    .nextSteps { background: #ecfdf5; border-color: #a7f3d0; }
    .nextList { margin: 12px 0 0; padding: 0; list-style: none; }
    .nextList li { display: flex; gap: 8px; margin-bottom: 8px; }
    .check { color: #047857; font-weight: 800; }
    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      font-size: 9px;
      color: var(--muted);
    }
    .divider { height: 1px; background: linear-gradient(90deg, var(--line), transparent); margin: 12px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>${esc(labels.heroTitle)}</h1>
      <p class="heroLead">${esc(labels.heroSubtitle)}</p>
      <div class="outcomeBand">
        <div class="outcomeLabel">${esc(labels.outcomeLabel)}</div>
        <div class="outcomeValue">${esc(labels.proceduralOutcome)}</div>
      </div>
      <div class="metaRow">
        <span>${esc(labels.reportIdLabel)}: ${esc(report.reportId)}</span>
        <span>${esc(labels.generatedAtLabel)}: ${esc(generatedAtDisplay)}</span>
      </div>
    </header>

    ${imageLimitedHtml}

    ${clinicalContextHtml}

    <div class="section">
      <div class="sectionHead"><h2>${esc(labels.scorecardsTitle)}</h2></div>
      <p class="sectionLead">${esc(labels.scorecardsSubtitle)}</p>
      <div class="scoreGrid">${scorecardsHtml}</div>
    </div>

    ${concernsHtml}

    <div class="section">
      <div class="sectionHead"><h2>${esc(labels.sectionsTitle)}</h2></div>
      <div class="divider"></div>
      ${sectionsHtml}
    </div>

    <div class="section">
      <div class="sectionHead"><h2>${esc(labels.imagesTitle)}</h2></div>
      <div class="imageGrid">${imagesHtml}</div>
    </div>

    ${postOperativeHtml}

    ${repairPlanningHtml}

    <div class="section trustBox">
      <div class="sectionHead"><h2>${esc(labels.trustTitle)}</h2></div>
      <p>${esc(labels.trustBody)}</p>
      <p style="margin-top:8px;">${esc(labels.trustNeutrality)}</p>
    </div>

    <div class="section nextSteps">
      <div class="sectionHead"><h2>${esc(labels.nextStepsTitle)}</h2></div>
      <p class="sectionLead">${esc(labels.nextStepsSubtitle)}</p>
      <ul class="nextList">${nextStepsHtml}</ul>
      <p style="margin-top:10px;"><strong>${esc(labels.repairLabel)}:</strong> ${esc(labels.repairState)}</p>
    </div>

    <footer class="footer">
      <p>${esc(labels.privacyStatement)}</p>
      <p style="margin-top:6px;">${esc(labels.footerLine)}</p>
    </footer>
  </div>
</body>
</html>`;
}
