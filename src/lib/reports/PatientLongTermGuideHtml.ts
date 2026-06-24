import type { PatientLongTermGuideContent, PatientLongTermGuideSection } from "./patientLongTermGuide";

function esc(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const PATIENT_LONG_TERM_GUIDE_CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  :root {
    --ink: #071229;
    --muted: #4f6486;
    --line: #d8e3f3;
    --line-strong: #b6c9e4;
    --card: #f7faff;
    --hero: #061a37;
    --gold: #d5a43a;
    --gold-soft: #f6e4b8;
    --card-radius: 15px;
  }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: var(--ink);
    background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .wrap { max-width: 820px; margin: 0 auto; padding: 0 8px 32px; }
  .pageBreak { page-break-before: always; break-before: page; }
  h1, h2 { page-break-after: avoid; break-after: avoid; }

  .hero {
    position: relative;
    border-radius: 18px;
    border: 1px solid rgba(160, 184, 219, 0.36);
    background: linear-gradient(140deg, #05172f 0%, #0c2f59 100%);
    color: #edf3ff;
    padding: 32px 28px;
    page-break-inside: avoid;
    box-shadow: 0 24px 48px rgba(2, 12, 35, 0.2);
  }
  .heroEyebrow {
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--gold-soft);
  }
  .heroTitle {
    margin: 10px 0 0;
    font-size: 28px;
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: #f8fbff;
  }
  .heroSubtitle {
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.65;
    color: #d8e4ff;
    max-width: 58ch;
  }

  .guideSection {
    margin-top: 22px;
    padding: 20px 18px;
    border: 1px solid var(--line);
    border-radius: var(--card-radius);
    background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
    page-break-inside: avoid;
    break-inside: avoid;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
  }
  .guideSectionHead {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }
  .sectionNumber {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: #78350f;
    background: linear-gradient(135deg, #fde68a, #fbbf24);
    border: 1px solid rgba(213, 164, 58, 0.45);
  }
  .guideSection h2 {
    margin: 0;
    font-size: 17px;
    letter-spacing: -0.01em;
    line-height: 1.25;
  }
  .sectionPurpose {
    margin: 0 0 12px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.55;
    max-width: 68ch;
  }
  .guideSection p {
    margin: 8px 0 0;
    font-size: 11.5px;
    line-height: 1.65;
    color: #334155;
    max-width: 72ch;
  }
  .guideSection ul {
    margin: 10px 0 0;
    padding-left: 18px;
    color: #334155;
  }
  .guideSection li {
    margin-bottom: 6px;
    font-size: 11.5px;
    line-height: 1.55;
  }
  .timelineList {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }
  .timelineItem {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid #e2e8f0;
  }
  .timelineItem:first-child { border-top: none; padding-top: 0; }
  .timelineLabel {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
  }
  .timelineDesc {
    font-size: 11.5px;
    line-height: 1.55;
    color: #334155;
  }
  .sectionClosing {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--line-strong);
    font-size: 11px;
    line-height: 1.6;
    color: #475569;
    font-style: italic;
  }
  .safetyStatement {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #fcd34d;
    background: #fffbeb;
    color: #78350f;
    font-size: 10.5px;
    line-height: 1.55;
  }
  .footer {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    font-size: 10px;
    line-height: 1.6;
    color: var(--muted);
  }
  .footer p { margin: 0 0 8px; max-width: 72ch; }

  @media screen and (max-width: 640px) {
    .wrap { padding: 0 12px 24px; }
    .hero { padding: 24px 18px; }
    .heroTitle { font-size: 22px; }
    .guideSection { padding: 16px 14px; }
    .timelineItem { grid-template-columns: 1fr; gap: 4px; }
  }
`;

function renderSectionBody(section: PatientLongTermGuideSection): string {
  const parts: string[] = [];

  if (section.paragraphs?.length) {
    for (const p of section.paragraphs) {
      parts.push(`<p>${esc(p)}</p>`);
    }
  }

  if (section.bullets?.length) {
    parts.push(
      `<ul>${section.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    );
  }

  if (section.timeline?.length) {
    parts.push(
      `<ul class="timelineList">${section.timeline
        .map(
          (period) =>
            `<li class="timelineItem"><div class="timelineLabel">${esc(period.label)}</div><div class="timelineDesc">${esc(period.description)}</div></li>`
        )
        .join("")}</ul>`
    );
  }

  if (section.safetyStatement) {
    parts.push(`<div class="safetyStatement">${esc(section.safetyStatement)}</div>`);
  }

  if (section.closing) {
    parts.push(`<p class="sectionClosing">${esc(section.closing)}</p>`);
  }

  return parts.join("");
}

function renderSection(section: PatientLongTermGuideSection): string {
  const purposeHtml = section.purpose
    ? `<p class="sectionPurpose">${esc(section.purpose)}</p>`
    : "";

  return `
    <section class="guideSection" id="section-${esc(section.id)}" aria-labelledby="title-${esc(section.id)}">
      <div class="guideSectionHead">
        <span class="sectionNumber" aria-hidden="true">${section.number}</span>
        <h2 id="title-${esc(section.id)}">${esc(section.title)}</h2>
      </div>
      ${purposeHtml}
      ${renderSectionBody(section)}
    </section>`;
}

export function renderPatientLongTermGuideHtml(content: PatientLongTermGuideContent): string {
  const sectionsHtml = content.sections.map(renderSection).join("");

  return `<!doctype html>
<html lang="${esc(content.locale)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(content.documentTitle)}</title>
  <style>${PATIENT_LONG_TERM_GUIDE_CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="heroEyebrow">${esc(content.coverAttribution)}</p>
      <h1 class="heroTitle">${esc(content.coverTitle)}</h1>
      <p class="heroSubtitle">${esc(content.coverSubtitle)}</p>
    </header>
    ${sectionsHtml}
    <footer class="footer">
      <p>${esc(content.footerDisclaimer)}</p>
      <p>${esc(content.educationalDisclaimer)}</p>
      <p>${esc(content.footerIndependence)}</p>
    </footer>
  </div>
</body>
</html>`;
}
