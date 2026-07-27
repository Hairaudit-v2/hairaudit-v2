/**
 * HA-PROJECTION-1G — Patient HTML for longitudinal projection review.
 * Renders via existing print → Playwright PDF pipeline.
 */

import type { LongitudinalProjectionReviewReportModel } from "./longitudinalProjectionReview";

export type LongitudinalProjectionReviewHtmlVm = {
  report: LongitudinalProjectionReviewReportModel;
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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "consistent":
      return "badge-neutral";
    case "partially_consistent":
      return "badge-amber";
    case "divergent":
      return "badge-slate";
    case "not_yet_assessable":
      return "badge-blue";
    case "insufficient_evidence":
      return "badge-muted";
    default:
      return "badge-neutral";
  }
}

export function renderLongitudinalProjectionReviewHtml(
  vm: LongitudinalProjectionReviewHtmlVm
): string {
  const { report, caseId: _caseId, generatedAtDisplay } = vm;
  void _caseId;

  const confidenceHtml = `
    <div class="confidenceGrid trio">
      <div class="confidenceCard projection">
        <div class="confidenceLabel">Projection Confidence</div>
        <div class="confidenceValue">${esc(report.projectionConfidence)}</div>
      </div>
      <div class="confidenceCard observation">
        <div class="confidenceLabel">Observation Confidence</div>
        <div class="confidenceValue">${esc(report.observationConfidence)}</div>
      </div>
      <div class="confidenceCard comparison">
        <div class="confidenceLabel">Comparison Confidence</div>
        <div class="confidenceValue">${esc(report.comparisonConfidence)}</div>
      </div>
    </div>
    <p class="confidenceExplain">${esc(report.confidenceExplanation)}</p>`;

  const overallHtml = `
    <div class="overallBox">
      <div class="confidenceLabel">Overall Comparison</div>
      <div class="overallValue">${esc(report.overallComparisonLabel)}</div>
      ${
        report.overallComparisonSummary
          ? `<p class="overallSummary">${esc(report.overallComparisonSummary)}</p>`
          : ""
      }
    </div>`;

  const projectionSummaryHtml = `
    <article class="summaryBlock projected">
      <div class="colTag">${esc(report.projectionSummaryLabel)}</div>
      <p>${esc(report.projectionSummary ?? "No surgery-day projection summary was available in the frozen snapshot.")}</p>
    </article>`;

  const observationSummaryHtml = `
    <article class="summaryBlock observed">
      <div class="colTag">${esc(report.observationSummaryLabel)}</div>
      <p>${esc(report.observationSummary ?? "No follow-up observation summary was available in the frozen snapshot.")}</p>
    </article>`;

  const domainCardsHtml = report.domainComparisons.length
    ? report.domainComparisons
        .map(
          (d) => `
      <article class="domainCard">
        <div class="domainHeader">
          <h3>${esc(d.title)}</h3>
          <span class="statusBadge ${statusBadgeClass(d.comparisonStatus)}">${esc(d.comparisonLabel)}</span>
        </div>
        <div class="dual">
          <div class="dualCol projected">
            <div class="colTag">${esc(d.projectedLabel)}</div>
            <p>${esc(d.projectedText)}</p>
          </div>
          <div class="dualCol observed">
            <div class="colTag">${esc(d.observedLabel)}</div>
            <p>${esc(d.observedText ?? "Not clearly observable from the submitted follow-up evidence.")}</p>
          </div>
        </div>
        <div class="compareMeta">
          <div class="metaItem">
            <div class="confidenceLabel">Comparison</div>
            <div class="metaValue">${esc(d.comparisonLabel)}</div>
          </div>
          <div class="metaItem">
            <div class="confidenceLabel">Comparison Confidence</div>
            <div class="metaValue">${esc(d.confidence)}</div>
          </div>
        </div>
        <div class="rationaleBox">
          <div class="confidenceLabel">Why</div>
          <p>${esc(d.rationale)}</p>
        </div>
        ${
          d.limitations.length
            ? `<div class="limitMini"><div class="confidenceLabel">Limitations</div>${renderList(d.limitations)}</div>`
            : ""
        }
      </article>`
        )
        .join("")
    : `<p class="muted">No domain comparisons were present in the frozen comparison snapshot.</p>`;

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
      <p class="muted small">This summary reflects identified treatment regions from the frozen surgery-day reconstruction. Exact coverage area is not measured. An untreated crown is not treated as a poor outcome.</p>`
    : "";

  const donorHtml =
    report.donorSurgeryDay.length || report.donorFollowUp.length
      ? `
      ${
        report.donorSurgeryDay.length
          ? `<div class="donorCol"><div class="colTag">Surgery-day donor observation</div>${renderList(report.donorSurgeryDay)}</div>`
          : ""
      }
      ${
        report.donorFollowUp.length
          ? `<div class="donorCol"><div class="colTag">Current donor observation</div>${renderList(report.donorFollowUp)}</div>`
          : `<p class="muted">No donor follow-up observation was available in the frozen snapshot.</p>`
      }
      <p class="muted small">Exact remaining follicular density cannot be measured from these images. This section is observational only.</p>`
      : `<p class="muted">No donor observations were available for this review.</p>`;

  const notYetHtml = report.notYetAssessable.length
    ? `
      ${report.month3NormalNotice ? `<p class="stageNote">${esc(report.month3NormalNotice)}</p>` : ""}
      ${report.notYetAssessable
        .map(
          (d) => `
        <article class="deferredCard">
          <h3>${esc(d.title)}</h3>
          <span class="statusBadge badge-blue">${esc(d.statusLabel)}</span>
          <p>${esc(d.rationale)}</p>
        </article>`
        )
        .join("")}`
    : report.month3NormalNotice
      ? `<p class="stageNote">${esc(report.month3NormalNotice)}</p>`
      : `<p class="muted">No domains are deferred as not yet assessable at this stage.</p>`;

  const insufficientHtml = report.insufficientEvidence.length
    ? `
      ${report.insufficientEvidence
        .map(
          (d) => `
        <article class="deferredCard evidence">
          <h3>${esc(d.title)}</h3>
          <span class="statusBadge badge-muted">${esc(d.statusLabel)}</span>
          <p>${esc(d.rationale)}</p>
        </article>`
        )
        .join("")}
      ${
        report.insufficientEvidenceCta
          ? `<p class="ctaNote">${esc(report.insufficientEvidenceCta)}</p>`
          : ""
      }`
    : `<p class="muted">No domains are limited solely by insufficient evidence at this stage.</p>`;

  const timelineHtml = `<ol class="timeline">
    ${report.timeline
      .map(
        (s) =>
          `<li class="${s.isCurrent ? "current" : ""} ${s.captured ? "captured" : "pending"}">
            <strong>${esc(s.label)}</strong>
            <span>${esc(s.description)}</span>
          </li>`
      )
      .join("")}
  </ol>`;

  const nextHtml = `
    <div class="nextBox">
      <div class="confidenceLabel">Next recommended capture point</div>
      <div class="metaValue">${esc(report.nextReview.label)}</div>
      <p>${esc(report.nextReview.description)}</p>
    </div>`;

  const imagesHtml = report.imageGroups.length
    ? report.imageGroups
        .map((g) => {
          if (g.id === "side_by_side" && g.pairs?.length) {
            return `
            <div class="imageGroup">
              <h3>${esc(g.title)}</h3>
              ${g.pairs
                .map(
                  (p) => `
                <div class="pairRow">
                  <div class="pairLabel">${esc(p.viewLabel)}</div>
                  <div class="pairGrid">
                    ${
                      p.surgeryDay
                        ? `<figure class="imageCard"><img class="patientPhoto" src="${esc(p.surgeryDay.url)}" alt="${esc(p.surgeryDay.label)}" /><figcaption>${esc(p.surgeryDay.label)}</figcaption></figure>`
                        : `<div class="imageMissing muted">Surgery Day — not available</div>`
                    }
                    ${
                      p.followUp
                        ? `<figure class="imageCard"><img class="patientPhoto" src="${esc(p.followUp.url)}" alt="${esc(p.followUp.label)}" /><figcaption>${esc(p.followUp.label)}</figcaption></figure>`
                        : `<div class="imageMissing muted">${esc(report.stageLabel)} — not available</div>`
                    }
                  </div>
                </div>`
                )
                .join("")}
            </div>`;
          }
          if (!g.images.length) return "";
          return `
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
            </div>`;
        })
        .join("")
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(report.reportTitle)} — ${esc(report.stageSubtitle)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    :root {
      --ink: #0b1a33;
      --muted: #4a5f7d;
      --line: #d5e2f2;
      --hero: #061a37;
      --amber: #b45309;
      --amber-bg: #fff7ed;
      --slate: #334155;
      --slate-bg: #f1f5f9;
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
    .hero h1 { margin: 8px 0 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
    .hero .subtitle { margin: 6px 0 0; font-size: 16px; font-weight: 700; color: #dbeafe; }
    .metaRow {
      margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; font-size: 10px; color: #c9d8ef;
    }
    .metaRow span { border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 4px 10px; }
    .noticeBanner {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(191, 219, 254, 0.45);
      color: #eff6ff;
      font-weight: 600;
      font-size: 12px;
    }
    .earlyBanner {
      margin-top: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(251, 191, 36, 0.18);
      border: 1px solid rgba(251, 191, 36, 0.45);
      color: #fff7ed;
      font-size: 11px;
      font-weight: 600;
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
    .confidenceGrid { display: grid; gap: 12px; margin-top: 14px; }
    .confidenceGrid.trio { grid-template-columns: 1fr 1fr 1fr; }
    .confidenceCard {
      border: 1px solid var(--line); border-radius: 12px; padding: 14px;
      background: linear-gradient(180deg, #f9fbff 0%, #fff 100%);
    }
    .confidenceCard.projection { border-color: #fbbf24; background: linear-gradient(180deg, #fffbeb 0%, #fff 100%); }
    .confidenceCard.observation { border-color: #93c5fd; background: linear-gradient(180deg, #eff6ff 0%, #fff 100%); }
    .confidenceCard.comparison { border-color: #cbd5e1; background: linear-gradient(180deg, #f8fafc 0%, #fff 100%); }
    .confidenceLabel { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
    .confidenceValue, .metaValue, .overallValue { margin-top: 6px; font-size: 18px; font-weight: 800; }
    .overallValue { font-size: 20px; }
    .confidenceExplain { margin: 12px 0 0; color: var(--muted); font-size: 10px; }
    .overallBox {
      margin-top: 14px; padding: 14px; border-radius: 12px;
      border: 1px solid var(--line); background: #f8fafc;
    }
    .overallSummary { margin: 8px 0 0; color: #334155; }
    .summaryBlock {
      margin-top: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--line);
      page-break-inside: avoid;
    }
    .summaryBlock.projected { border-color: #fbbf24; background: #fffbeb; }
    .summaryBlock.observed { border-color: #93c5fd; background: #f8fbff; }
    .colTag {
      display: inline-block; font-size: 9px; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--ink); margin-bottom: 6px;
    }
    .domainCard {
      margin-top: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 12px;
      background: #fff; page-break-inside: avoid;
    }
    .domainHeader { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    .domainHeader h3 { margin: 0; font-size: 14px; }
    .statusBadge {
      display: inline-block; font-size: 10px; font-weight: 700; padding: 4px 10px;
      border-radius: 8px; border: 1px solid var(--line); background: #f8fafc; color: var(--ink);
    }
    .badge-neutral { background: #f8fafc; border-color: #cbd5e1; color: #334155; }
    .badge-amber { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
    .badge-slate { background: var(--slate-bg); border-color: #94a3b8; color: var(--slate); }
    .badge-blue { background: #eff6ff; border-color: #93c5fd; color: #1e3a8a; }
    .badge-muted { background: #f1f5f9; border-color: #cbd5e1; color: #64748b; }
    .dual { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .dualCol { border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
    .dualCol.projected { border-color: #fbbf24; background: #fffbeb; }
    .dualCol.observed { border-color: #93c5fd; background: #f8fbff; }
    .dualCol p, .summaryBlock p, .rationaleBox p { margin: 6px 0 0; color: #334155; word-wrap: break-word; overflow-wrap: anywhere; }
    .compareMeta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .metaItem { padding: 10px; border-radius: 10px; background: #f8fafc; border: 1px solid var(--line); }
    .rationaleBox, .limitMini { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px solid var(--line); }
    .areaTable { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .areaTable th, .areaTable td { border-bottom: 1px solid var(--line); text-align: left; padding: 8px 6px; }
    .areaTable th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .donorCol { margin-top: 12px; }
    .deferredCard {
      margin-top: 10px; padding: 12px; border-radius: 10px; border: 1px solid #bfdbfe; background: #eff6ff;
      page-break-inside: avoid;
    }
    .deferredCard.evidence { border-color: #cbd5e1; background: #f8fafc; }
    .deferredCard h3 { margin: 0 0 6px; font-size: 13px; }
    .stageNote, .ctaNote {
      margin-top: 10px; padding: 10px 12px; border-radius: 10px;
      background: var(--amber-bg); border: 1px solid #fdba74; color: #9a3412; font-weight: 600;
    }
    .timeline { margin: 12px 0 0; padding: 0; list-style: none; }
    .timeline li {
      display: grid; grid-template-columns: 110px 1fr; gap: 10px;
      padding: 10px 0; border-bottom: 1px solid #edf2f9;
      page-break-inside: avoid;
    }
    .timeline li.pending { opacity: 0.55; }
    .timeline li.current strong { color: #1d4ed8; }
    .timeline li:last-child { border-bottom: none; }
    .nextBox {
      margin-top: 12px; padding: 14px; border-radius: 12px;
      border: 1px solid var(--line); background: #f8fafc;
    }
    .imageGroup { margin-top: 14px; page-break-inside: avoid; }
    .imageGroup h3 { margin: 0; font-size: 13px; }
    .imageGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 10px; }
    .pairRow { margin-top: 12px; }
    .pairLabel { font-weight: 700; margin-bottom: 6px; }
    .pairGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .imageCard { margin: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f8fafc; }
    .patientPhoto { width: 100%; height: auto; max-height: 220px; object-fit: contain; display: block; background: #e8eef7; }
    .imageCard figcaption { padding: 8px 10px; font-size: 10px; color: var(--muted); }
    .imageMissing {
      border: 1px dashed var(--line); border-radius: 12px; padding: 24px; text-align: center; background: #f8fafc;
    }
    .plainList { margin: 8px 0 0; padding-left: 18px; }
    .plainList li { margin-bottom: 6px; }
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
      .section, .domainCard, .summaryBlock, .imageGroup, .deferredCard { break-inside: avoid; }
      h2, h3 { break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="brand">HairAudit</div>
      <h1>${esc(report.reportTitle)}</h1>
      <p class="subtitle">${esc(report.stageSubtitle)}</p>
      <div class="noticeBanner">${esc(report.reviewNotice)}</div>
      ${
        report.earlyStageNotice
          ? `<div class="earlyBanner">${esc(report.earlyStageNotice)}</div>`
          : ""
      }
      <div class="metaRow">
        ${report.procedureDateDisplay ? `<span>Procedure date: ${esc(report.procedureDateDisplay)}</span>` : ""}
        ${report.originalProjectionDateDisplay ? `<span>Original projection: ${esc(report.originalProjectionDateDisplay)}</span>` : ""}
        ${report.followUpObservationDateDisplay ? `<span>Follow-up observation: ${esc(report.followUpObservationDateDisplay)}</span>` : ""}
        <span>Review stage: ${esc(report.reviewStageDisplay)}</span>
        <span>Generated: ${esc(generatedAtDisplay)}</span>
      </div>
    </header>

    <section class="section">
      <h2>Follow-up Stage &amp; Evidence Confidence</h2>
      <p class="sectionLead">Three confidence measures remain separate. They are not averaged into a single score.</p>
      ${confidenceHtml}
      ${overallHtml}
    </section>

    ${
      imagesHtml
        ? `<section class="section">
            <h2>Evidence Images</h2>
            <p class="sectionLead">Surgery-day and follow-up views where available. Labels use Surgery Day / ${esc(report.stageLabel)} rather than marketing before-and-after framing.</p>
            ${imagesHtml}
            ${
              report.imageComparisonCaveat
                ? `<p class="muted small" style="margin-top:12px;">${esc(report.imageComparisonCaveat)}</p>`
                : ""
            }
          </section>`
        : ""
    }

    <section class="section">
      <h2>Original Surgery-Day Projection Summary</h2>
      <p class="sectionLead">Frozen projection characteristics from surgery day. Not regenerated for this review.</p>
      ${projectionSummaryHtml}
    </section>

    <section class="section">
      <h2>Current Observed Follow-Up Summary</h2>
      <p class="sectionLead">Frozen observational findings at ${esc(report.stageLabel)}.</p>
      ${observationSummaryHtml}
    </section>

    <section class="section">
      <h2>Projected vs Observed — Domain Review</h2>
      <p class="sectionLead">Each domain keeps Projected, Observed, Comparison, Confidence, and Why separate.</p>
      ${domainCardsHtml}
    </section>

    ${
      treatmentHtml
        ? `<section class="section">
            <h2>Treatment-Area Context</h2>
            <p class="sectionLead">Semantic treatment summary from the frozen surgery-day reconstruction.</p>
            ${treatmentHtml}
          </section>`
        : ""
    }

    <section class="section">
      <h2>Donor Review</h2>
      <p class="sectionLead">Observational donor findings. Not scored as donor success or depletion percentage.</p>
      ${donorHtml}
    </section>

    <section class="section">
      <h2>Not Yet Assessable</h2>
      <p class="sectionLead">Early biological timing is distinct from missing performance.</p>
      ${notYetHtml}
    </section>

    <section class="section">
      <h2>More Evidence Needed</h2>
      <p class="sectionLead">Stage may support comparison, but submitted photographs are inadequate for these domains.</p>
      ${insufficientHtml}
    </section>

    <section class="section">
      <h2>Follow-up Timeline</h2>
      <p class="sectionLead">Only stages actually captured are marked as observed reviews.</p>
      ${timelineHtml}
    </section>

    <section class="section">
      <h2>Next Recommended Capture Point</h2>
      ${nextHtml}
    </section>

    <section class="disclaimer">
      <h2>Clinical Disclaimer</h2>
      <p>${esc(report.clinicalDisclaimer)}</p>
    </section>

    <footer class="footer">
      <p>HairAudit independent longitudinal review. Patient-safe projected vs observed presentation.</p>
      <p style="margin-top:6px;">Case reference retained for secure report access controls only. Snapshot identifiers are not shown in the patient body.</p>
    </footer>
  </div>
</body>
</html>`;
}
