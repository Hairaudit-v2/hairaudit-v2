/**
 * HA-PROJECTION-1C — Patient HTML for surgery-day projected result reports.
 * Renders via existing print → Playwright PDF pipeline.
 */

import type { SurgeryDayProjectionReport } from "./surgeryDayProjectionReport";

export type SurgeryDayProjectionReportHtmlVm = {
  report: SurgeryDayProjectionReport;
  caseId: string;
  generatedAtDisplay: string;
};

function esc(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(items: string[], className = "plainList"): string {
  if (!items.length) return "";
  return `<ul class="${className}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

export function renderSurgeryDayProjectionReportHtml(
  vm: SurgeryDayProjectionReportHtmlVm
): string {
  const { report, caseId, generatedAtDisplay } = vm;

  const confidenceHtml = `
    <div class="confidenceGrid">
      <div class="confidenceCard reconstruction">
        <div class="confidenceLabel">Reconstruction confidence</div>
        <div class="confidenceValue">${esc(report.reconstructionConfidence)}</div>
      </div>
      <div class="confidenceCard projection">
        <div class="confidenceLabel">Projection confidence</div>
        <div class="confidenceValue">${esc(report.projectionConfidence)}</div>
      </div>
    </div>
    <p class="confidenceExplain">${esc(report.projectionConfidenceExplanation)}</p>`;

  const evidenceRolesHtml = report.evidenceRoles.length
    ? `<div class="chipRow">${report.evidenceRoles
        .map((r) => `<span class="chip">${esc(r)}</span>`)
        .join("")}</div>`
    : "";

  const limitationsHtml = report.evidenceLimitations.length
    ? `<div class="limitBox"><h3>Evidence limitations</h3>${renderList(report.evidenceLimitations)}</div>`
    : "";

  const procedureHtml = report.procedureContextFields.length
    ? `<div class="metricGrid">${report.procedureContextFields
        .map(
          (f) => `
        <div class="metricCard">
          <div class="metricLabel">${esc(f.label)}</div>
          <div class="metricValue">${esc(f.value)}</div>
          ${f.provenanceNote ? `<div class="metricSource">${esc(f.provenanceNote)}</div>` : ""}
        </div>`
        )
        .join("")}</div>`
    : "";

  const observedHtml = report.observedToday.length
    ? report.observedToday
        .map(
          (b) => `
      <article class="obsBlock">
        <div class="obsTag">Observed Today</div>
        <h3>${esc(b.title)}</h3>
        <p>${esc(b.observation)}</p>
        ${
          b.confidence
            ? `<div class="miniMeta">Observation confidence: ${esc(b.confidence)}</div>`
            : ""
        }
      </article>`
        )
        .join("")
    : `<p class="muted">No structured surgery-day observations were available for presentation.</p>`;

  const treatmentHtml = report.treatmentAreas.length
    ? `<table class="areaTable">
        <thead><tr><th>Area</th><th>Status</th></tr></thead>
        <tbody>
          ${report.treatmentAreas
            .map(
              (r) =>
                `<tr><td>${esc(r.zoneLabel)}</td><td>${esc(r.stateLabel)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
      <p class="muted small">This summary reflects identified treatment regions from available evidence. Exact coverage area is not measured.</p>`
    : "";

  const projectedHtml = report.projectedCharacteristics.length
    ? report.projectedCharacteristics
        .map(
          (c) => `
      <article class="projDomain">
        <h3>${esc(c.title)}</h3>
        <div class="triple">
          <div class="tripleCol observed">
            <div class="colTag">Observed</div>
            <p>${esc(c.observation)}</p>
          </div>
          <div class="tripleCol projected">
            <div class="colTag">Projected Characteristic</div>
            <p>${esc(c.projection)}</p>
          </div>
          <div class="tripleCol limits">
            <div class="colTag">Limitations / Confidence</div>
            <p><strong>Confidence:</strong> ${esc(
              c.confidence === "high"
                ? "High"
                : c.confidence === "moderate"
                  ? "Moderate"
                  : "Low"
            )}</p>
            ${renderList(c.limitations)}
          </div>
        </div>
      </article>`
        )
        .join("")
    : `<p class="muted">No projected cosmetic characteristics were available from the validated projection.</p>`;

  const graftRecordsHtml = report.graftEvidence.procedureRecords.length
    ? `<div class="metricGrid">${report.graftEvidence.procedureRecords
        .map(
          (r) => `
        <div class="metricCard">
          <div class="metricLabel">${esc(r.label)}</div>
          <div class="metricValue">${esc(r.value)}</div>
          ${r.source ? `<div class="metricSource">Source: ${esc(r.source)}</div>` : ""}
        </div>`
        )
        .join("")}</div>`
    : "";

  const giiHtml = report.graftEvidence.imageDerivedEstimate
    ? `<div class="giiBox">
        <div class="metricLabel">Image-derived estimate</div>
        <div class="metricValue">${esc(report.graftEvidence.imageDerivedEstimate.rangeLabel)}</div>
        <div class="metricSource">Confidence: ${esc(
          report.graftEvidence.imageDerivedEstimate.confidence
        )}</div>
        <p class="muted small">Kept separate from clinic- or patient-reported counts.</p>
      </div>`
    : "";

  const graftConflictHtml = report.graftEvidence.conflictNote
    ? `<p class="noteBanner">${esc(report.graftEvidence.conflictNote)}</p>`
    : "";

  const donorHtml = report.donorObservations.length
    ? renderList(report.donorObservations)
    : "";

  const timelineHtml = `<ol class="timeline">
    ${report.biologicalTimeline
      .map(
        (s) =>
          `<li><strong>${esc(s.period)}</strong><span>${esc(s.description)}</span></li>`
      )
      .join("")}
  </ol>
  <p class="muted">${esc(report.biologicalTimelineNote)}</p>`;

  const cannotHtml = `<div class="cannotBox">
    <h2>What Cannot Yet Be Determined</h2>
    <p class="sectionLead">These items remain unknown from surgery-day evidence alone.</p>
    ${renderList(report.whatCannotYetBeDetermined, "cannotList")}
  </div>`;

  const futureHtml = `
    <p>${esc(report.futureComparisonIntro)}</p>
    <p class="muted">At future HairAudit reviews, your observed result can be compared with this original surgery-day projection.</p>
    <div class="milestoneRow">
      ${report.futureComparisonMilestones
        .map(
          (m) =>
            `<div class="milestone"><strong>${esc(m.label)}</strong><span>${esc(
              m.description
            )}</span></div>`
        )
        .join("")}
    </div>
    <p class="muted small">Comparison reviews are described for future use and are not implemented in this report.</p>`;

  const nextHtml = renderList(report.recommendedNextSteps, "nextList");

  const imagesHtml = report.imageGroups.length
    ? report.imageGroups
        .map(
          (g) => `
      <div class="imageGroup">
        <h3>${esc(g.title)}</h3>
        <div class="imageGrid">
          ${g.images
            .map(
              (img) => `
            <figure class="imageCard">
              <img class="patientPhoto" src="${esc(img.url)}" alt="${esc(img.label)}" />
              <figcaption>${esc(img.label)}</figcaption>
            </figure>`
            )
            .join("")}
        </div>
      </div>`
        )
        .join("")
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(report.reportTitle)} — ${esc(caseId)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    :root {
      --ink: #0b1a33;
      --muted: #4a5f7d;
      --line: #d5e2f2;
      --hero: #061a37;
      --amber: #b45309;
      --amber-bg: #fff7ed;
      --cannot: #7f1d1d;
      --cannot-bg: #fef2f2;
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
      page-break-inside: avoid;
    }
    .brand { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #c9d8ef; font-weight: 700; }
    .hero h1 { margin: 8px 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; }
    .metaRow {
      margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; font-size: 10px; color: #c9d8ef;
    }
    .metaRow span { border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 4px 10px; }
    .projectionBanner {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(180, 83, 9, 0.22);
      border: 1px solid rgba(251, 191, 36, 0.55);
      color: #fff7ed;
      font-weight: 700;
      font-size: 12px;
    }
    .modeBanner {
      margin-top: 10px;
      font-size: 11px;
      color: #d8e6ff;
    }
    .section {
      margin-top: 20px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      page-break-inside: avoid;
    }
    .section h2 { margin: 0; font-size: 16px; letter-spacing: -0.01em; }
    .sectionLead { margin: 8px 0 0; color: var(--muted); }
    .confidenceGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .confidenceCard {
      border: 1px solid var(--line); border-radius: 12px; padding: 14px;
      background: linear-gradient(180deg, #f9fbff 0%, #fff 100%);
    }
    .confidenceCard.projection { border-color: #fbbf24; background: linear-gradient(180deg, #fffbeb 0%, #fff 100%); }
    .confidenceLabel { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
    .confidenceValue { margin-top: 6px; font-size: 22px; font-weight: 800; }
    .confidenceExplain { margin: 12px 0 0; color: var(--muted); font-size: 10px; }
    .chipRow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .chip {
      border: 1px solid var(--line); border-radius: 999px; padding: 5px 10px;
      background: #f8fafc; font-size: 10px; font-weight: 600;
    }
    .limitBox { margin-top: 14px; padding: 12px; border-radius: 10px; background: #f8fafc; border: 1px solid var(--line); }
    .limitBox h3 { margin: 0 0 8px; font-size: 12px; }
    .metricGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
    .metricCard, .giiBox {
      border: 1px solid var(--line); border-radius: 12px; padding: 12px;
      background: linear-gradient(180deg, #f9fbff 0%, #fff 100%);
    }
    .giiBox { margin-top: 12px; border-color: #93c5fd; }
    .metricLabel { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
    .metricValue { margin-top: 6px; font-size: 18px; font-weight: 800; }
    .metricSource { margin-top: 4px; font-size: 10px; color: var(--muted); }
    .obsBlock {
      margin-top: 12px; padding: 12px; border: 1px solid #dbeafe; border-radius: 12px; background: #f8fbff;
      page-break-inside: avoid;
    }
    .obsTag, .colTag {
      display: inline-block; font-size: 9px; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; color: #1d4ed8; margin-bottom: 6px;
    }
    .obsBlock h3, .projDomain h3, .imageGroup h3 { margin: 0; font-size: 13px; }
    .obsBlock p, .tripleCol p { margin: 6px 0 0; color: #334155; }
    .miniMeta { margin-top: 8px; font-size: 10px; color: var(--muted); }
    .areaTable { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .areaTable th, .areaTable td { border-bottom: 1px solid var(--line); text-align: left; padding: 8px 6px; }
    .areaTable th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .projDomain { margin-top: 14px; page-break-inside: avoid; }
    .triple { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
    .tripleCol { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: #fff; }
    .tripleCol.observed { border-color: #93c5fd; background: #f8fbff; }
    .tripleCol.projected { border-color: #fbbf24; background: #fffbeb; }
    .tripleCol.limits { border-color: #e2e8f0; background: #f8fafc; }
    .tripleCol .colTag { color: var(--ink); }
    .noteBanner {
      margin-top: 12px; padding: 10px 12px; border-radius: 10px;
      background: var(--amber-bg); border: 1px solid #fdba74; color: #9a3412; font-weight: 600;
    }
    .timeline { margin: 12px 0 0; padding: 0; list-style: none; }
    .timeline li {
      display: grid; grid-template-columns: 110px 1fr; gap: 10px;
      padding: 10px 0; border-bottom: 1px solid #edf2f9;
      page-break-inside: avoid;
    }
    .timeline li:last-child { border-bottom: none; }
    .cannotBox {
      margin-top: 20px; padding: 18px; border-radius: 14px;
      background: var(--cannot-bg); border: 1px solid #fecaca; page-break-inside: avoid;
    }
    .cannotBox h2 { margin: 0; color: var(--cannot); font-size: 16px; }
    .cannotList { margin: 12px 0 0; padding-left: 18px; }
    .cannotList li { margin-bottom: 6px; font-weight: 600; color: #7f1d1d; }
    .milestoneRow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .milestone {
      border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: #f8fafc;
      display: flex; flex-direction: column; gap: 4px;
    }
    .milestone span { color: var(--muted); font-size: 10px; }
    .plainList, .nextList { margin: 12px 0 0; padding-left: 18px; }
    .plainList li, .nextList li { margin-bottom: 6px; }
    .imageGroup { margin-top: 14px; page-break-inside: avoid; }
    .imageGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 10px; }
    .imageCard { margin: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f8fafc; }
    .patientPhoto { width: 100%; height: auto; max-height: 220px; object-fit: contain; display: block; background: #e8eef7; }
    .imageCard figcaption { padding: 8px 10px; font-size: 10px; color: var(--muted); }
    .muted { color: var(--muted); }
    .small { font-size: 10px; }
    .disclaimer {
      margin-top: 20px; padding: 16px; border-radius: 12px;
      background: #f1f5f9; border: 1px solid #cbd5e1; page-break-inside: avoid;
    }
    .footer {
      margin-top: 22px; padding-top: 12px; border-top: 1px solid var(--line);
      font-size: 9px; color: var(--muted);
    }
    @media print {
      .section, .projDomain, .obsBlock, .cannotBox, .imageGroup { break-inside: avoid; }
      h2, h3 { break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="brand">HairAudit</div>
      <h1>${esc(report.reportTitle)}</h1>
      <div class="projectionBanner">${esc(report.safetyBanner)}</div>
      <p class="modeBanner">${esc(report.modeBanner)}</p>
      <div class="metaRow">
        <span>Report: ${esc(report.reportId)}</span>
        <span>Generated: ${esc(generatedAtDisplay)}</span>
        <span>Mode: ${esc(report.assessmentType.replaceAll("_", " "))}</span>
      </div>
    </header>

    <section class="section">
      <h2>Evidence &amp; Confidence</h2>
      <p class="sectionLead">Evidence Available</p>
      ${confidenceHtml}
      ${evidenceRolesHtml}
      ${limitationsHtml}
    </section>

    ${
      imagesHtml
        ? `<section class="section"><h2>Key surgery-day images</h2>${imagesHtml}</section>`
        : ""
    }

    ${
      procedureHtml
        ? `<section class="section"><h2>Procedure Context</h2>${procedureHtml}</section>`
        : ""
    }

    <section class="section">
      <h2>What HairAudit Can Observe Today</h2>
      <p class="sectionLead">Present-day observations from surgery-day reconstruction evidence.</p>
      ${observedHtml}
    </section>

    ${
      treatmentHtml
        ? `<section class="section"><h2>Treatment Areas</h2>${treatmentHtml}</section>`
        : ""
    }

    <section class="section">
      <h2>Projected Cosmetic Characteristics</h2>
      <p class="sectionLead">Each domain keeps Observed, Projected Characteristic, and Limitations separate.</p>
      ${projectedHtml}
    </section>

    ${
      graftRecordsHtml || giiHtml
        ? `<section class="section">
            <h2>Graft / Procedure Evidence</h2>
            <p class="sectionLead">Procedure records</p>
            ${graftConflictHtml}
            ${graftRecordsHtml}
            ${giiHtml}
          </section>`
        : ""
    }

    ${
      donorHtml
        ? `<section class="section"><h2>Donor Observations</h2>${donorHtml}</section>`
        : ""
    }

    <section class="section">
      <h2>Expected Biological Timeline</h2>
      <p class="sectionLead">Generic educational timeline — not a patient-specific prediction.</p>
      ${timelineHtml}
    </section>

    ${cannotHtml}

    <section class="section">
      <h2>Future HairAudit Comparison</h2>
      ${futureHtml}
    </section>

    <section class="section">
      <h2>Recommended Next Steps</h2>
      ${nextHtml}
    </section>

    <section class="disclaimer">
      <h2>Clinical Disclaimer</h2>
      <p>${esc(report.clinicalDisclaimer)}</p>
    </section>

    <footer class="footer">
      <p>HairAudit independent review. Patient-safe projected analysis presentation.</p>
      <p style="margin-top:6px;">Case reference retained for secure report access controls only.</p>
    </footer>
  </div>
</body>
</html>`;
}
