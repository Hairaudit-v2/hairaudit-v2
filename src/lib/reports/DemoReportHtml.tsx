/**
 * HairAudit Demo / Sample Report HTML template.
 * 6-page structure: Cover, Domain Overview, Visual Evidence (redacted), Confidence, Fingerprint + Findings, What Full Reports Include + CTA.
 * No real patient data or imagery; for website preview and commercial presentation.
 */

import { renderRadarSvg } from "@/lib/reports/radarSvg";
import { demoReportData } from "@/lib/reports/demoReportData";

function esc(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderDemoReportHtml(): string {
  const d = demoReportData;

  const radarSvg =
    d.radar.labels.length >= 3
      ? renderRadarSvg({
          labels: d.radar.labels,
          values: d.radar.values,
          size: 1080,
          levels: 5,
          overall: d.radar.overall,
          confidence: d.radar.confidence,
        })
      : "";

  const radarPanel =
    radarSvg &&
    `<div class="radarPanel">
      <div class="panelTitle">Diagnostic Radar Signature</div>
      <div class="radarWrap">${radarSvg}</div>
      <div class="miniText">Balanced performance signatures indicate consistency across key transplant domains.</div>
    </div>`;

  const domainCardsHtml = d.domainCards
    .map(
      (card, idx) => {
        const scoreWidth = Math.max(5, Math.min(100, Math.round(card.score)));
        const scoreClass = card.score >= 80 ? "high" : card.score >= 60 ? "medium" : "low";
        return `
        <div class="domainCard ${idx % 2 ? "domainAlt" : ""}">
          <div class="domainTop">
            <h3>${esc(card.title)}</h3>
            <div class="domainScoreValue">${card.score} / 100</div>
          </div>
          <div class="bar"><div class="barFill ${scoreClass}" style="width:${scoreWidth}%;"></div></div>
          <div class="microTitle">Observation</div>
          <p class="miniText">${esc(card.observation)}</p>
          <div class="microTitle">Why It Matters</div>
          <p class="miniText">${esc(card.whyItMatters)}</p>
          <div class="microTitle">Monitoring Guidance</div>
          <p class="miniText">${esc(card.monitoring)}</p>
        </div>`;
      }
    )
    .join("");

  const keyMetricsCard = `
    <div class="metricCard keyMetricCard">
      <div class="metricTitle">Key Metrics</div>
      <div class="metricList">
        <div><span>Donor quality</span><b>${esc(d.metrics.donorQuality)}</b></div>
        <div><span>Survival estimate</span><b>${esc(d.metrics.graftSurvival)}</b></div>
        <div><span>Transection risk</span><b>${esc(d.metrics.transectionRisk)}</b></div>
        <div><span>Implant density</span><b>${esc(d.metrics.implantationDensity)}</b></div>
        <div><span>Hairline naturalness</span><b>${esc(d.metrics.hairlineNaturalness)}</b></div>
        <div><span>Donor scar visibility</span><b>${esc(d.metrics.donorScarVisibility)}</b></div>
      </div>
    </div>
  `;

  const ci = d.confidenceIntegrity;
  const confidenceIntegrityCards = `
    <div class="infoGrid evidenceInfoGrid">
      <div class="panelCard">
        <div class="panelTitle">AI Confidence</div>
        <div class="kpiValue">${ci.aiConfidencePct}%</div>
        <div class="kpiSub">${esc(ci.confidenceBand)} confidence band</div>
        <div class="miniText">Confidence reflects visual evidence clarity and completeness across submitted documentation.</div>
      </div>
      <div class="panelCard">
        <div class="panelTitle">Data Integrity</div>
        <div class="kpiValue">${ci.imagesAnalyzed}</div>
        <div class="kpiSub">images analyzed (sample)</div>
        <ul class="kpiList">
          <li>Donor views: ${ci.donorViews}</li>
          <li>Recipient views: ${ci.recipientViews}</li>
          <li>Intra-operative images: ${ci.intraOpViews}</li>
        </ul>
        <div class="miniText">Evidence completeness: ${esc(ci.evidenceCompleteness)}</div>
      </div>
    </div>
  `;

  const fingerprintCardsHtml = d.fingerprintCards
    .map((card) => {
      const conf = String(card.confidence).toLowerCase();
      const confidenceClass =
        conf === "high" ? "fpPillHigh" : conf === "moderate" ? "fpPillModerate" : "fpPillLow";
      const stripe = [0, 1, 2, 3, 4]
        .map((idx) => {
          const threshold = (idx + 1) * 20;
          const active = card.strength >= threshold;
          return `<span class="fpDot ${active ? "active" : ""}"></span>`;
        })
        .join("");
      return `
      <div class="fpCard">
        <div class="fpHead">
          <div class="fpTitleWrap"><span class="fpIcon">${esc(card.icon)}</span><h4>${esc(card.title)}</h4></div>
          <span class="fpPill ${confidenceClass}">${esc(card.confidence)}</span>
        </div>
        <div class="fpLabel">${esc(card.label)}</div>
        <p class="miniText"><b>AI Observation:</b> ${esc(card.observation)}</p>
        <p class="miniText"><b>Why It Matters:</b> ${esc(card.whyItMatters)}</p>
        <div class="fpStrength">${stripe}</div>
      </div>`;
    })
    .join("");

  // Placeholder panels for Visual Evidence (no real images)
  const visualPlaceholders = `
    <div class="demoEvidencePlaceholder">
      <div class="demoPlaceholderCard">
        <div class="demoPlaceholderBlock"></div>
        <div class="demoPlaceholderLabel">Pre-operative review</div>
        <p class="miniText">Baseline donor and recipient context.</p>
      </div>
      <div class="demoPlaceholderCard">
        <div class="demoPlaceholderBlock"></div>
        <div class="demoPlaceholderLabel">Recipient site review</div>
        <p class="miniText">Spacing, directionality, density distribution.</p>
      </div>
      <div class="demoPlaceholderCard">
        <div class="demoPlaceholderBlock"></div>
        <div class="demoPlaceholderLabel">Follow-up analysis</div>
        <p class="miniText">Healing and progression over time.</p>
      </div>
    </div>
    <div class="demoEvidenceBullets">
      <div class="panelTitle">What HairAudit assesses in full reports</div>
      <ul class="microList">
        <li>Donor extraction patterns and distribution</li>
        <li>Recipient spacing and directionality</li>
        <li>Density distribution across zones</li>
        <li>Healing and follow-up progression</li>
      </ul>
    </div>
  `;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>HairAudit Sample Report</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    :root {
      --ink: #071229;
      --muted: #4f6486;
      --line: #d8e3f3;
      --line-strong: #b6c9e4;
      --card: #f7faff;
      --soft: #f0f6ff;
      --hero: #061a37;
      --gold: #d5a43a;
      --gold-soft: #f6e4b8;
      --card-radius: 15px;
      --card-padding: 20px;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap { max-width: 910px; margin: 0 auto; padding: 0 4px; }
    .pageBreak { page-break-before: always; break-before: page; }
    h2 { page-break-after: avoid; break-after: avoid; }

    .demoBadge {
      position: absolute;
      top: 14px;
      right: 14px;
      padding: 6px 12px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      border: 1px solid rgba(255,255,255,0.4);
    }

    .hero {
      position: relative;
      border-radius: 18px;
      border: 1px solid rgba(160, 184, 219, 0.36);
      background: linear-gradient(140deg, #05172f 0%, #0c2f59 100%);
      color: #edf3ff;
      padding: 30px;
      page-break-inside: avoid;
      box-shadow: 0 34px 64px rgba(2, 12, 35, 0.24);
    }
    .heroTexture {
      position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
      background: repeating-linear-gradient(120deg, rgba(148,163,184,0.08) 0, rgba(148,163,184,0.08) 1px, transparent 1px, transparent 22px);
      opacity: .45;
    }
    .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; position: relative; z-index: 1; }
    .brand { display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; }
    .title { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.01em; color: #f8fbff; line-height: 1.2; }
    .heroSubtitle { margin-top: 7px; font-size: 12px; color: #d8e4ff; line-height: 1.6; max-width: 500px; font-weight: 500; }
    .meta {
      text-align: right;
      font-size: 10px;
      color: #d6e3fb;
      line-height: 1.5;
      min-width: 216px;
      border: 1px solid rgba(180, 199, 230, 0.35);
      border-radius: 12px;
      background: rgba(7, 20, 41, 0.35);
      padding: 13px 15px;
    }
    .meta b { color: #ffffff; }
    .metaRow { padding: 3px 0; border-bottom: 1px dashed rgba(203,213,225,0.25); }
    .metaRow:last-child { border-bottom: none; }

    .section { margin-top: 28px; padding: 18px; border: 1px solid var(--line); border-radius: var(--card-radius); background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%); page-break-inside: avoid; break-inside: avoid; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.045); }
    .section.pageBreak { margin-top: 0; }
    .p1Section { margin-top: 32px; }
    .sectionHead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 0; }
    .sectionHead h2 { margin: 0; font-size: 19px; letter-spacing: -0.01em; line-height: 1.2; }
    .sectionDivider { height: 1px; margin: 0 0 12px; background: linear-gradient(90deg, rgba(182,201,228,0.65), rgba(182,201,228,0.08)); }
    .pillRow { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .pill { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line-strong); background: #fff; font-size: 11px; color: var(--muted); }
    .pill b { color: var(--ink); }

    .p1Zone {
      position: relative;
      margin-top: 32px;
      margin-bottom: 28px;
      border: 1px solid rgba(182, 201, 228, 0.55);
      border-radius: 18px;
      padding: 32px;
      background: linear-gradient(180deg, #fafdff 0%, #f2f7ff 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 18px 36px rgba(15,23,42,0.07);
    }
    .heroDashboard { position: relative; z-index: 1; border: 1px solid rgba(198, 214, 236, 0.6); border-radius: 18px; padding: 20px; background: linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(244,250,255,0.88) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.92); }
    .execLayout { display: grid; grid-template-columns: 1.18fr 1.12fr; gap: 26px; align-items: stretch; }
    .scoreBadge {
      position: relative;
      border: 1px solid rgba(213, 164, 58, 0.45);
      border-radius: 24px;
      padding: 32px;
      background: linear-gradient(155deg, #ffffff 0%, #e6f0ff 100%);
      min-height: 520px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 24px 48px rgba(213, 164, 58, 0.22);
    }
    .scoreLabel { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #556685; font-weight: 700; }
    .scoreBubble {
      width: 278px; height: 278px; border-radius: 999px;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      border: 1px solid rgba(213,164,58,0.45);
      background: radial-gradient(circle at 30% 20%, #ffffff 0%, #dbe9fb 100%);
      box-shadow: inset 0 0 0 8px rgba(255,255,255,0.78), 0 22px 42px rgba(15,23,42,.14);
    }
    .scoreValue { font-size: 92px; font-weight: 900; line-height: 1; letter-spacing: -0.05em; color: #061733; }
    .scoreSub { font-size: 10px; color: #4e678b; margin-top: 6px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
    .tierTag { margin-top: 14px; display: inline-flex; padding: 9px 14px; border-radius: 999px; border: 1px solid rgba(213,164,58,.55); font-size: 11px; font-weight: 800; background: var(--gold-soft); }
    .scoreConfLine { margin-top: 16px; font-size: 11px; color: #2b4a72; line-height: 1.65; max-width: 93%; font-weight: 600; }
    .p1RightCol { display: flex; flex-direction: column; height: 100%; min-height: 520px; }
    .keyMetricCard { margin-top: 0; margin-bottom: 24px; }

    .metricCard, .panelCard { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff; }
    .metricTitle, .panelTitle { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
    .radarPanel {
      margin-top: 0; margin-bottom: 0;
      border: 1px solid #e6edf3;
      border-radius: 12px;
      padding: 16px 20px 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      min-height: 480px;
    }
    .radarPanel .panelTitle { font-size: 15px; font-weight: 800; letter-spacing: .07em; margin: 0 0 4px 0; color: #0f2344; text-transform: uppercase; }
    .radarWrap { margin-top: 4px; flex: 1 1 0; min-height: 0; display: flex; justify-content: center; align-items: center; padding: 8px 10px; }
    .radarWrap svg { display: block; margin: 0 auto; width: 100%; max-width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(14,165,233,0.15); }
    .radarPanel .miniText { flex: 0 0 auto; margin-top: 10px; margin-bottom: 0; line-height: 1.5; }
    .infoGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; align-items: stretch; }
    .evidenceInfoGrid { margin-top: 20px; }
    .p1Zone .panelCard { box-shadow: 0 6px 16px rgba(15,23,42,0.03); background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%); border: 1px solid #e6edf3; border-radius: 14px; padding: 22px; min-height: 224px; display: flex; flex-direction: column; justify-content: flex-start; }
    .p1Zone .panelTitle { margin-bottom: 12px; }
    .kpiValue { font-size: 34px; font-weight: 900; letter-spacing: -0.02em; color: #0f2344; margin-top: 6px; line-height: 1.05; }
    .kpiSub { font-size: 11px; color: #4e678b; margin-top: 6px; }
    .kpiList { margin: 11px 0 0; padding-left: 18px; }
    .kpiList li { margin: 3px 0; font-size: 11px; color: #112545; }
    .executiveDivider { border-top: 1px solid #e6edf3; margin-top: 28px; margin-bottom: 18px; height: 0; }
    .summaryCard { margin-top: 0; border: 1px solid var(--line); border-radius: 14px; padding: 22px; background: #fff; }
    .summaryCard .panelTitle { font-size: 12.5px; color: #385173; margin-bottom: 12px; }
    .summaryCard .miniText { font-size: 13px; line-height: 1.65; max-width: 700px; color: #102543; }

    .domainGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
    .domainCard { border: 1px solid var(--line); border-radius: 14px; padding: 20px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
    .domainAlt { background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%); }
    .domainTop { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .domainTop h3 { margin: 0; font-size: 14px; }
    .domainScoreValue { font-size: 12px; font-weight: 800; color: #0f172a; white-space: nowrap; }
    .bar { margin-top: 8px; height: 8px; background: #e7edf6; border-radius: 999px; overflow: hidden; }
    .barFill { height: 100%; border-radius: 999px; }
    .barFill.high { background: #059669; }
    .barFill.medium { background: #d97706; }
    .barFill.low { background: #64748b; }
    .microTitle { margin-top: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #637793; font-weight: 800; }
    .microList { margin: 6px 0 0; padding-left: 17px; }
    .microList li { margin: 4px 0; font-size: 11px; color: #11223a; }
    .metricList { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .metricList div { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; flex-wrap: wrap; }
    .metricList span { color: var(--muted); }
    .metricList b { color: var(--ink); word-break: break-word; max-width: 65%; text-align: right; }

    .evidenceSectionTitle { font-size: 20px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 4px 0; }
    .evidenceSectionSubtitle { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 0 0 12px 0; }
    .demoEvidencePlaceholder {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 16px;
    }
    .demoPlaceholderCard {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      page-break-inside: avoid;
    }
    .demoPlaceholderBlock {
      height: 120px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(148,163,184,0.25) 0%, rgba(100,116,139,0.2) 100%);
      border: 1px dashed rgba(100,116,139,0.4);
      margin-bottom: 12px;
    }
    .demoPlaceholderLabel { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 6px; }
    .demoEvidenceBullets { margin-top: 20px; padding: 16px; border: 1px solid rgba(148,163,184,0.35); border-radius: 12px; background: #fff; }
    .demoWatermark { position: absolute; bottom: 8px; right: 12px; font-size: 9px; color: rgba(100,116,139,0.6); font-weight: 700; text-transform: uppercase; letter-spacing: .1em; }

    .fingerprintSection { margin-top: 12px; border: 1px solid #bae6fd; border-radius: 14px; padding: 20px; background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%); page-break-inside: avoid; }
    .fpGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .fpCard { border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; background: #fff; page-break-inside: avoid; }
    .fpHead { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .fpTitleWrap { display: flex; align-items: center; gap: 6px; }
    .fpTitleWrap h4 { margin: 0; font-size: 12px; }
    .fpIcon { width: 20px; height: 20px; border-radius: 999px; border: 1px solid var(--line); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
    .fpPill { font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 8px; border: 1px solid transparent; }
    .fpPillHigh { background: #dcfce7; color: #166534; border-color: #86efac; }
    .fpPillModerate { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .fpPillLow { background: #e2e8f0; color: #334155; border-color: #cbd5e1; }
    .fpLabel { margin-top: 6px; font-size: 12px; font-weight: 800; color: #0f172a; }
    .fpStrength { margin-top: 8px; display: flex; gap: 4px; }
    .fpDot { width: 14px; height: 5px; border-radius: 999px; background: #e2e8f0; }
    .fpDot.active { background: #38bdf8; }

    .twoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .listCard { border: 1px solid var(--line); border-radius: var(--card-radius); padding: var(--card-padding); background: #fff; page-break-inside: avoid; }
    .listTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .listCard ul { margin: 0; padding-left: 18px; }
    .listCard li { font-size: 11px; color: var(--ink); margin: 6px 0; }
    .iconPositive { color: #15803d; }
    .iconWatch { color: #b45309; }
    .iconOutlook { color: #6d28d9; }
    .miniText { margin-top: 6px; font-size: 11px; color: var(--ink); line-height: 1.5; }

    .ctaSection {
      margin-top: 28px;
      padding: 32px;
      border-radius: 18px;
      border: 1px solid rgba(14, 165, 233, 0.3);
      background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%);
      page-break-inside: avoid;
    }
    .ctaSection h2 { margin: 0 0 8px 0; font-size: 22px; color: #0c4a6e; }
    .ctaSection .ctaSub { font-size: 12px; color: #0369a1; margin-bottom: 20px; }
    .ctaGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
    .ctaCard {
      border: 1px solid rgba(14,165,233,0.4);
      border-radius: 14px;
      padding: 18px;
      background: #fff;
      text-align: center;
      page-break-inside: avoid;
    }
    .ctaCard strong { display: block; font-size: 13px; color: #0c4a6e; margin-bottom: 6px; }
    .ctaCard span { font-size: 11px; color: var(--muted); }
    .valueList { margin: 12px 0 0; padding-left: 18px; }
    .valueList li { margin: 6px 0; font-size: 12px; color: var(--ink); line-height: 1.5; }

    .footer { margin-top: 18px; font-size: 10px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 8px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    @media print {
      .wrap { padding: 0; }
      .section { margin-top: 14px; padding: 12px; }
      .section.pageBreak { margin-top: 0; }
      .domainGrid, .fpGrid { grid-template-columns: 1fr; }
      .demoEvidencePlaceholder { grid-template-columns: 1fr; }
      .ctaGrid { grid-template-columns: 1fr; }
      .scoreBadge { min-height: 390px; padding: 24px; }
      .scoreBubble { width: 220px; height: 220px; }
      .scoreValue { font-size: 72px; }
      .p1RightCol { min-height: 390px; }
      .radarPanel { min-height: 360px; padding: 14px 18px 16px; }
    }
  </style>
</head>
<body>
  <div class="wrap">

    <!-- PAGE 1: COVER / EXECUTIVE INTELLIGENCE SUMMARY -->
    <div class="hero">
      <span class="demoBadge">Sample Report</span>
      <div class="heroTexture"></div>
      <div class="topbar">
        <div class="brand">
          <h1 class="title">HairAudit AI Surgical Analysis</h1>
          <div class="heroSubtitle">AI-Assisted Transplant Quality Review</div>
        </div>
        <div class="meta">
          <div class="metaRow"><b>Case ID</b> <span class="mono">${esc(d.caseId)}</span></div>
          <div class="metaRow"><b>Report Date</b> ${esc(d.generatedAt)}</div>
          <div class="metaRow"><b>Model Version</b> ${esc(d.modelVersion)}</div>
          <div class="metaRow"><b>Confidence Label</b> ${esc(d.confidenceBand)}</div>
        </div>
      </div>
    </div>

    <div class="section p1Section">
      <div class="sectionHead">
        <h2>Executive Intelligence Summary</h2>
        <div class="pillRow">
          <span class="pill">Overall Surgical Quality Score</span>
          <span class="pill">Report: <b>v${d.version}</b></span>
          <span class="pill">Sample Report</span>
        </div>
      </div>
      <div class="sectionDivider"></div>

      <div class="p1Zone">
        <div class="heroDashboard">
          <div class="execLayout">
            <div class="scoreBadge">
              <div class="scoreLabel">Overall Surgical Quality Score</div>
              <div class="scoreBubble">
                <div class="scoreValue">${d.overallScore}</div>
                <div class="scoreSub">out of 100</div>
              </div>
              <div class="tierTag" style="background:${d.scoreBand.color};">Tier: ${esc(d.scoreBand.label)}</div>
              <div class="scoreConfLine">Confidence: ${d.confidencePct}% — based on sample data for illustration.</div>
            </div>
            <div class="p1RightCol">${radarPanel || ""}</div>
          </div>
        </div>
      </div>

      <div class="executiveDivider"></div>
      <div class="summaryCard">
        <div class="panelTitle">Executive AI Summary</div>
        <div class="miniText">${esc(d.executiveSummary)}</div>
      </div>
    </div>

    <!-- PAGE 2: DOMAIN ANALYSIS OVERVIEW -->
    <div class="section pageBreak">
      <div class="sectionHead">
        <h2>Domain Analysis Overview</h2>
        <span class="pill">Key metrics & domain cards</span>
      </div>
      <div class="sectionDivider"></div>
      ${keyMetricsCard}
      <div class="domainGrid">${domainCardsHtml}</div>
    </div>

    <!-- PAGE 3: VISUAL EVIDENCE ANALYSIS (REDACTED SAMPLE MODE) -->
    <div class="section pageBreak">
      <div class="sectionHead">
        <div>
          <h2 class="evidenceSectionTitle">Visual Evidence Analysis</h2>
          <div class="evidenceSectionSubtitle">Restricted in sample report to protect patient privacy. Full reports include annotated donor, recipient, and follow-up imagery.</div>
        </div>
        <span class="pill">Sample — no patient images</span>
      </div>
      <div class="sectionDivider"></div>
      <div style="position:relative;">
        ${visualPlaceholders}
        <div class="demoWatermark">Sample Report</div>
      </div>
    </div>

    <!-- PAGE 4: AI CONFIDENCE + DATA INTEGRITY -->
    <div class="section pageBreak">
      <div class="sectionHead">
        <h2>AI Confidence & Data Integrity</h2>
        <span class="pill">Evidence completeness</span>
      </div>
      <div class="sectionDivider"></div>
      ${confidenceIntegrityCards}
      <div class="limitPanel" style="margin-top:16px;">
        <b>Evidence limitations (sample):</b> ${(ci.limitations || []).map((l) => esc(l)).join(" ")}
      </div>
    </div>

    <!-- PAGE 5: AI SURGICAL FINGERPRINT + FINDINGS -->
    <div class="section pageBreak">
      <div class="sectionHead">
        <h2>AI Surgical Fingerprint & Findings</h2>
        <span class="pill">Key indicators & outlook</span>
      </div>
      <div class="sectionDivider"></div>
      <div class="fingerprintSection">
        <div class="panelTitle">AI Surgical Fingerprint Analysis</div>
        <div class="miniText">Pattern-based visual review of extraction, implantation, spacing, and density consistency.</div>
        <div class="fpGrid">${fingerprintCardsHtml}</div>
      </div>
      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle"><span class="iconPositive">●</span> Key Positive Indicators</div>
          <ul>${d.highlights.map((x) => `<li>✔ ${esc(x)}</li>`).join("")}</ul>
        </div>
        <div class="listCard">
          <div class="listTitle"><span class="iconWatch">●</span> Areas Requiring Review</div>
          <ul>${d.risks.map((x) => `<li>⚠ ${esc(x)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="listCard" style="margin-top:12px;">
        <div class="listTitle"><span class="iconOutlook">●</span> Predictive Outlook</div>
        <div class="miniText">${esc(d.predictiveOutlook)}</div>
      </div>
    </div>

    <!-- PAGE 6: WHAT FULL REPORTS INCLUDE / CTA -->
    <div class="section pageBreak">
      <div class="sectionHead">
        <h2>What Full HairAudit Reports Include</h2>
      </div>
      <div class="sectionDivider"></div>
      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle">Patient-facing value</div>
          <ul class="valueList">
            <li>Independent, evidence-based quality review</li>
            <li>Clear score breakdown and confidence bands</li>
            <li>Actionable guidance for follow-up or repair planning</li>
            <li>Documentation suitable for second opinions</li>
          </ul>
        </div>
        <div class="listCard">
          <div class="listTitle">Clinic-facing value</div>
          <ul class="valueList">
            <li>Structured audit trail and quality assurance</li>
            <li>Benchmarking and consistency metrics</li>
            <li>Transparency for patients and referring providers</li>
          </ul>
        </div>
      </div>
      <div class="listCard" style="margin-top:12px;">
        <div class="listTitle">Internal audit & quality improvement</div>
        <ul class="valueList">
          <li>Domain-level scores for training and protocol refinement</li>
          <li>Evidence completeness feedback to improve documentation</li>
        </ul>
      </div>

      <div class="ctaSection">
        <h2>Next steps</h2>
        <p class="ctaSub">Request an audit, book a demo, or create a clinic profile.</p>
        <div class="ctaGrid">
          <div class="ctaCard">
            <strong>Request an Audit</strong>
            <span>Get a full report for your case</span>
          </div>
          <div class="ctaCard">
            <strong>Book a Demo</strong>
            <span>See the platform for your clinic</span>
          </div>
          <div class="ctaCard">
            <strong>Create a Clinic Profile</strong>
            <span>Join the HairAudit network</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      This is a sample report for illustration. It does not contain real patient data or imagery.
      Full reports are generated from submitted case evidence and are subject to our terms and privacy policy.
    </div>
  </div>
</body>
</html>`;

  return html;
}
