import type { ReportViewModel } from "@/lib/pdf/reportBuilder";
import { buildSurgicalFingerprintSummary } from "@/lib/reports/surgicalFingerprint";

type AreaScoreItem = {
  title: string;
  score: number;
  outOf5: number;
  level: string;
};

type EliteRadarVm = {
  labels: string[];
  values: number[]; // 0-100
  overall: number; // 0-100
  confidence: number; // 0-1
};

export type EliteReportViewModel = {
  viewModel: ReportViewModel;
  caseId: string;
  caseStatus?: string | null;
  caseCreatedAt?: string;
  generatedAt: string;
  version?: number;
  grade?: string | null;
  confidenceLabel?: string | null;
  metrics: {
    donorQuality: string;
    graftSurvival: string;
    transectionRisk: string;
    implantationDensity: string;
    hairlineNaturalness: string;
    donorScarVisibility: string;
  };
  areaDomains: AreaScoreItem[];
  sectionScores: AreaScoreItem[];
  highlights: string[];
  risks: string[];
  radar?: EliteRadarVm;
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]>;
  doctorBlockHtml?: string;
  debugFooter?: string;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function clamp100(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

function escapeXml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLabel(label: string, maxLen: number): string[] {
  const s = String(label ?? "").trim();
  if (!s || s.length <= maxLen) return [s || ""];
  const words = s.split(/\s+/g).filter(Boolean);
  if (words.length <= 1) return [s.slice(0, maxLen), s.slice(maxLen)].filter(Boolean).slice(0, 2);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLen) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length >= 2) break;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// Radar is rendered as inline SVG (not server-side PNG) to avoid serverless wasm bundling issues.
function renderRadarSvg(opts: {
  labels: string[];
  values: number[];
  size: number;
  levels: number;
  overall: number;
  confidence: number;
}): string {
  const size = Math.max(360, Math.floor(opts.size));
  const levels = Math.max(3, Math.min(7, Math.floor(opts.levels)));

  // Best-effort cap (labels stay readable for print).
  const maxAxes = 10;
  const hardCapAxes = opts.labels.length > maxAxes ? 8 : maxAxes;
  const labels = opts.labels.slice(0, hardCapAxes);
  const values = opts.values.slice(0, labels.length);

  const n = labels.length;
  const width = size;
  const height = size;
  const cx = width / 2;
  const cy = height / 2;
  const padding = n <= 5 ? 136 : n <= 7 ? 120 : 108; // extra room for readable axis titles
  const rMax = Math.max(60, Math.min(width, height) / 2 - padding);
  const angleStep = (2 * Math.PI) / Math.max(1, n);

  const labelFontSize = n > 8 ? 11 : 14;
  const maxLabelLen = n > 8 ? 12 : 18;

  const pointsFor = (r: number) =>
    Array.from({ length: n }, (_, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(" ");

  const ringPolys = Array.from({ length: levels }, (_, idx) => {
    const pct = (idx + 1) / levels;
    const r = rMax * pct;
    const opacity = idx === levels - 1 ? 0.14 : 0.09;
    return `<polygon points="${pointsFor(r)}" fill="none" stroke="rgba(148,163,184,${opacity})" stroke-width="1.1"/>`;
  }).join("\n  ");

  const spokes = Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + rMax * Math.cos(angle);
    const y = cy + rMax * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>`;
  }).join("\n  ");

  const valuePts = values.map((raw, i) => {
    const v = clamp100(Number(raw));
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (v / 100) * rMax;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y };
  });

  const allZeros = values.every((v) => !Number.isFinite(v) || Number(v) === 0);
  const polygon = allZeros
    ? ""
    : `<polygon points="${valuePts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="rgba(45,212,191,0.25)" stroke="rgba(45,212,191,0.96)" stroke-width="2.8"/>`;
  const dots = allZeros
    ? ""
    : valuePts
        .map(
          (p) =>
            `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="rgba(251,191,36,0.96)" stroke="#0b1226" stroke-width="1"/>`
        )
        .join("\n  ");

  const labelElems = labels
    .map((label, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const tx = cx + (rMax + 44) * Math.cos(angle);
      const ty = cy + (rMax + 44) * Math.sin(angle);
      const anchor =
        Math.abs(Math.cos(angle)) < 0.28 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
      const lines = wrapLabel(label, maxLabelLen);
      return lines
        .map((line, j) => {
          const dy = (j - (lines.length - 1) / 2) * (labelFontSize + 2);
          return `<text x="${tx}" y="${ty + dy}" fill="rgba(226,232,240,0.88)" font-size="${labelFontSize}" font-weight="700" font-family="Arial,sans-serif" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(line)}</text>`;
        })
        .join("\n  ");
    })
    .join("\n  ");

  const overall = Math.round(clamp100(opts.overall));
  const conf01 = clamp01(opts.confidence);
  const confPct = Math.round(conf01 * 100);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
  <defs>
    <linearGradient id="eliteRadarBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#081225"/>
      <stop offset="1" stop-color="#042a2a"/>
    </linearGradient>
    <radialGradient id="eliteRadarGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="rgba(45,212,191,0.10)"/>
      <stop offset="0.55" stop-color="rgba(251,191,36,0.06)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="url(#eliteRadarBg)"/>
  <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="url(#eliteRadarGlow)"/>

  ${ringPolys}
  ${spokes}
  ${polygon}
  ${dots}

  <text x="${cx}" y="${cy - 6}" fill="rgba(226,232,240,0.12)" font-size="${Math.round(
    height * 0.18
  )}" font-weight="800" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">${overall}</text>
  <text x="${cx}" y="${cy + Math.round(height * 0.11)}" fill="rgba(226,232,240,0.88)" font-size="${Math.round(
    height * 0.04
  )}" font-weight="700" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Confidence: ${confPct}%</text>
  ${allZeros ? `<text x="${cx}" y="${cy + Math.round(height * 0.18)}" fill="rgba(226,232,240,0.6)" font-size="11" font-weight="600" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Performance data will populate as sections are scored</text>` : ""}
  <text x="${cx}" y="${height - 18}" fill="rgba(226,232,240,0.72)" font-size="11" font-weight="600" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">Audit Performance Signature</text>

  ${labelElems}
</svg>`;
}

export function renderEliteReportHtml(vm: EliteReportViewModel): string {
  const { caseId, generatedAt, version, metrics, areaDomains, sectionScores, highlights, risks, radar, photosByCategory, doctorBlockHtml, debugFooter } = vm;
  const overallScore = typeof vm.viewModel.score === "number" && Number.isFinite(vm.viewModel.score) ? vm.viewModel.score : null;
  const viewModelExt = vm.viewModel as ReportViewModel & {
    model?: string;
    confidencePanel?: {
      confidenceScore?: number;
      confidenceLabel?: string;
      missingCategories?: string[];
      limitations?: string[];
    };
    forensic?: {
      summary?: string;
      key_findings?: Array<{
        title?: string;
        impact?: string;
        recommended_next_step?: string;
        evidence?: Array<{ observation?: string }>;
      }>;
      surgical_fingerprint?: {
        donor_extraction_pattern?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        recipient_site_distribution?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        hairline_transition_pattern?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        density_consistency_signature?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
        direction_angle_coherence?: {
          label?: string;
          confidence?: "high" | "moderate" | "low";
          observation?: string;
          why_it_matters?: string;
        };
      };
    };
    graftIntegrity?: {
      auditor_status?: "approved" | "pending" | "needs_more_evidence" | "rejected";
      claimed_grafts?: number | null;
      estimated_implanted?: { min?: number | null; max?: number | null };
      confidence?: number;
      confidence_label?: "low" | "medium" | "high";
      limitations?: string[];
    } | null;
  };
  const forensic = viewModelExt.forensic;
  const keyFindings = Array.isArray(forensic?.key_findings) ? forensic.key_findings : [];
  const narrativeText = String(forensic?.summary ?? "").trim();
  const confidenceNumeric =
    typeof viewModelExt.confidencePanel?.confidenceScore === "number"
      ? viewModelExt.confidencePanel.confidenceScore
      : typeof radar?.confidence === "number"
        ? radar.confidence
        : null;
  const confidencePct = confidenceNumeric == null ? null : Math.round(clamp01(confidenceNumeric) * 100);
  const confidenceScorePct = confidencePct == null ? "N/A" : `${confidencePct}%`;
  const confidenceBand =
    confidencePct == null ? "Limited" : confidencePct >= 80 ? "High" : confidencePct >= 60 ? "Moderate" : "Low";
  const modelVersion = String(viewModelExt.model ?? version ? `v${String(version ?? "")}` : "N/A").trim();
  const scoreBand = (() => {
    if (overallScore == null) return { label: "Review", color: "#F6C46D" };
    if (overallScore >= 90) return { label: "Platinum", color: "#DDE7F5" };
    if (overallScore >= 80) return { label: "Gold", color: "#F5E6A7" };
    if (overallScore >= 70) return { label: "Silver", color: "#E6E6E6" };
    if (overallScore >= 60) return { label: "Bronze", color: "#E9D0B3" };
    return { label: "Review", color: "#F6C46D" };
  })();
  const norm = (s: string) => s.toLowerCase();
  const average = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  const findScore = (matchers: string[]) => {
    const domainScores = areaDomains
      .filter((d) => matchers.some((m) => norm(d.title).includes(m)))
      .map((d) => d.score);
    if (domainScores.length) return average(domainScores);
    const secScores = sectionScores
      .filter((s) => matchers.some((m) => norm(s.title).includes(m)))
      .map((s) => s.score);
    return average(secScores);
  };
  const domains = [
    {
      title: "Donor Management",
      match: ["donor"],
      clinical: "Donor management patterns may influence long-term donor preservation and visual uniformity.",
      monitoring: "Monitor donor density and visible donor homogeneity over the next 6-12 months.",
    },
    {
      title: "Recipient Site Design",
      match: ["recipient", "hairline", "naturalness", "design"],
      clinical: "Recipient site distribution can influence naturalness and zone-to-zone balance.",
      monitoring: "Monitor transition softness, frontal framing, and regional blending during growth cycles.",
    },
    {
      title: "Graft Handling",
      match: ["graft", "hydrat", "viability", "storage", "out-of-body"],
      clinical: "Graft handling consistency may influence viability and downstream growth quality.",
      monitoring: "Where evidence is limited, request procedural details or additional intra-operative documentation.",
    },
    {
      title: "Implantation Technique",
      match: ["implant", "placement", "spacing", "angle", "density"],
      clinical: "Implantation spacing and angle coherence can influence visual density and native blending.",
      monitoring: "Track maturing density pattern and directional consistency between regions.",
    },
    {
      title: "Documentation Quality",
      match: ["document", "aftercare", "safety", "evidence", "photo"],
      clinical: "Documentation quality determines confidence in all pattern-based interpretations.",
      monitoring: "Add missing captures where possible to improve future confidence and longitudinal comparability.",
    },
  ];
  const domainCards = domains
    .map((domain, idx) => {
      const score = findScore(domain.match);
      const matchingFindings = keyFindings.filter((f) =>
        domain.match.some((m) => norm(String(f?.title ?? "")).includes(m) || norm(String(f?.impact ?? "")).includes(m))
      );
      const observation =
        String(matchingFindings[0]?.impact ?? "").trim() ||
        (score == null
          ? "Assessment is limited by available evidence in this domain."
          : score >= 80
            ? "Observed patterns appear consistent with stronger domain performance."
            : score >= 65
              ? "Observed patterns are mixed with moderate confidence."
              : "Observed patterns suggest this area may benefit from closer follow-up.");
      const evidence = matchingFindings
        .flatMap((f) => (Array.isArray(f?.evidence) ? f.evidence : []))
        .map((e) => String(e?.observation ?? "").trim())
        .filter(Boolean)
        .slice(0, 3);
      const guidance = String(matchingFindings[0]?.recommended_next_step ?? "").trim() || domain.monitoring;
      const scoreWidth = score == null ? 10 : Math.max(5, Math.min(100, Math.round(score)));
      const scoreClass = score == null ? "low" : score >= 80 ? "high" : score >= 60 ? "medium" : "low";
      const scoreLabel = score == null ? "Insufficient evidence" : `${Math.round(score)} / 100`;
      return `
        <div class="domainCard ${idx % 2 ? "domainAlt" : ""}">
          <div class="domainTop">
            <h3>${esc(domain.title)}</h3>
            <div class="domainScoreValue">${esc(scoreLabel)}</div>
          </div>
          <div class="bar"><div class="barFill ${scoreClass}" style="width:${scoreWidth}%;"></div></div>
          <div class="microTitle">Observation</div>
          <p class="miniText">${esc(observation)}</p>
          <div class="microTitle">Why It Matters</div>
          <p class="miniText">${esc(domain.clinical)}</p>
          <div class="microTitle">Evidence</div>
          <ul class="microList">
            ${(evidence.length ? evidence : ["No high-confidence evidence bullets were available for this domain."])
              .map((item) => `<li>${esc(item)}</li>`)
              .join("")}
          </ul>
          <div class="microTitle">Monitoring Guidance</div>
          <p class="miniText">${esc(guidance)}</p>
        </div>
      `;
    })
    .join("");

  const photoCategoryKeys = Object.keys(photosByCategory ?? {});
  const photoCatsWithItems = photoCategoryKeys.filter((cat) => (photosByCategory[cat] ?? []).some((x) => !!x?.signedUrl));
  const allPhotos = photoCatsWithItems.flatMap((cat) => (photosByCategory[cat] ?? []).filter((x) => !!x?.signedUrl));
  const catLower = photoCatsWithItems.map((x) => x.toLowerCase());
  const donorViews = catLower.filter((x) => x.includes("donor")).length;
  const recipientViews = catLower.filter((x) => x.includes("recipient") || x.includes("front") || x.includes("top") || x.includes("crown")).length;
  const intraViews = catLower.filter((x) => x.includes("intra")).length;
  const missingCats = Array.isArray(viewModelExt.confidencePanel?.missingCategories)
    ? viewModelExt.confidencePanel!.missingCategories!.filter(Boolean)
    : [];
  const limitationNotes = Array.isArray(viewModelExt.confidencePanel?.limitations)
    ? viewModelExt.confidencePanel!.limitations!.filter(Boolean)
    : [];

  const executiveSummary =
    narrativeText.length > 0
      ? narrativeText.split(".").slice(0, 2).join(".").trim() + (narrativeText.includes(".") ? "." : "")
      : "This report summarizes pattern-based AI observations across donor, recipient, implantation, and documentation evidence.";
  const scoreConfLine =
    confidencePct == null
      ? "Confidence: N/A - based on available donor and recipient evidence."
      : `Confidence: ${confidencePct}% - based on available donor and recipient evidence.`;
  const compactStatus = (label: string, tone: "good" | "watch" | "note", value: string) =>
    `<div class="riskPill ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const donorRisk =
    /high|elevated|poor/i.test(`${metrics.transectionRisk} ${metrics.donorQuality}`) ? "Watch" : "Stable";
  const recipientConsistency =
    /insufficient|uneven|variable/i.test(`${metrics.implantationDensity} ${metrics.hairlineNaturalness}`)
      ? "Mixed"
      : "Consistent";
  const docCompleteness =
    allPhotos.length >= 8 && missingCats.length === 0 ? "Strong" : allPhotos.length >= 4 ? "Moderate" : "Limited";
  const implantConfidence = confidencePct == null ? "Limited" : confidencePct >= 80 ? "High" : confidencePct >= 60 ? "Moderate" : "Low";
  const riskStrip = `
    <div class="riskStrip">
      ${compactStatus("Donor Preservation Risk", donorRisk === "Stable" ? "good" : "watch", donorRisk)}
      ${compactStatus("Recipient Density Consistency", recipientConsistency === "Consistent" ? "good" : "watch", recipientConsistency)}
      ${compactStatus("Documentation Completeness", docCompleteness === "Strong" ? "good" : docCompleteness === "Moderate" ? "note" : "watch", docCompleteness)}
      ${compactStatus("Implantation Pattern Confidence", implantConfidence === "High" ? "good" : implantConfidence === "Moderate" ? "note" : "watch", implantConfidence)}
    </div>
  `;

  const mapToEvidenceGroup = (rawCat: string): { key: string; title: string; icon: string; order: number } => {
    const lower = rawCat.toLowerCase();
    if (lower.includes("pre-op") || lower.includes("preop") || lower.includes("pre-operative")) return { key: "preop", title: "Pre-Operative", icon: "◇", order: 0 };
    if (lower.includes("donor") && (lower.includes("day") || lower.includes("day0"))) return { key: "donor", title: "Donor Region (Day 0)", icon: "◯", order: 1 };
    if (lower.includes("recipient") || lower.includes("day-of recipient")) return { key: "recipient", title: "Recipient Area (Day 0)", icon: "▣", order: 2 };
    if (lower.includes("intra") || lower.includes("intra-op")) return { key: "intra", title: "Intra-Operative Views", icon: "◫", order: 3 };
    if (lower.includes("post-op") || lower.includes("postop") || lower.includes("current") || lower.includes("follow")) return { key: "postop", title: "Post-Operative / Follow-Up", icon: "▤", order: 4 };
    if (lower.includes("donor")) return { key: "donor", title: "Donor Region (Day 0)", icon: "◯", order: 1 };
    return { key: "other", title: String(rawCat).replaceAll("_", " "), icon: "▢", order: 5 };
  };
  const agg: Record<string, { key: string; title: string; icon: string; order: number; items: { signedUrl: string; label: string }[] }> = {};
  for (const cat of photoCatsWithItems) {
    const items = (photosByCategory[cat] ?? []).filter((x) => !!x?.signedUrl).map((x) => ({ signedUrl: String(x.signedUrl), label: String(x.label || "Photo").trim() || "Image" }));
    if (items.length === 0) continue;
    const mapped = mapToEvidenceGroup(cat);
    const existing = agg[mapped.key];
    if (existing) {
      existing.items.push(...items);
    } else {
      agg[mapped.key] = { key: mapped.key, title: mapped.title, icon: mapped.icon, order: mapped.order, items };
    }
  }
  const evidenceGroups = Object.values(agg).sort((a, b) => a.order - b.order);
  const groupObservation = (key: string): string => {
    if (key === "donor") return "Donor region appears evenly harvested with no obvious clustering patterns in the available views.";
    if (key === "recipient") return "Recipient captures were reviewed for spacing pattern, directional flow, and density balance cues.";
    if (key === "intra") return "Intra-operative captures were reviewed for procedural context and handling visibility.";
    if (key === "preop") return "Pre-operative views provide baseline context for donor and recipient assessment.";
    if (key === "postop") return "Follow-up imagery provides longitudinal context for healing and growth pattern evaluation.";
    return "Submitted captures were reviewed for category-specific visual context.";
  };
  const groupConfidence = (items: { signedUrl: string; label: string }[], key: string): "high" | "moderate" | "limited" => {
    const n = items.length;
    if (n >= 2 && (confidencePct == null || confidencePct >= 70)) return "high";
    if (n >= 1 && (confidencePct == null || confidencePct >= 50)) return "moderate";
    return "limited";
  };
  const photoGroups = evidenceGroups.length
    ? evidenceGroups
        .map((g) => {
          const conf = groupConfidence(g.items, g.key);
          const confClass = conf === "high" ? "high" : conf === "moderate" ? "moderate" : "limited";
          const confLabel = conf === "high" ? "High" : conf === "moderate" ? "Moderate" : "Limited";
          const obs = groupObservation(g.key);
          const isSingle = g.items.length === 1;
          return `
            <div class="evidenceGroup">
              <div class="evidenceGroupHead">
                <div class="evidenceGroupIcon">${esc(g.icon)}</div>
                <div class="evidenceGroupTitle">${esc(g.title)}</div>
              </div>
              <div class="evidencePhotoGrid${isSingle ? " single" : ""}">
                ${g.items
                  .map(
                    (u) => `
                      <figure class="evidencePhotoCard">
                        <div class="imgWrap">
                          <img src="${esc(u.signedUrl)}" alt="${esc(u.label)}" />
                        </div>
                        <figcaption class="imgLabel">${esc(u.label || "Photo")}</figcaption>
                      </figure>
                    `
                  )
                  .join("")}
              </div>
              <div class="evidenceObsPanel">
                <div class="evidenceObsRow">
                  <span class="evidenceConfPill ${confClass}">Confidence: ${esc(confLabel)}</span>
                </div>
                <div><b>Observation</b> — ${esc(obs)}</div>
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="emptyState">No photo evidence groups were available for this report.</div>`;

  const patientGuidance = domains.map((d) => d.monitoring).slice(0, 4);
  const predictiveOutlook =
    metrics.graftSurvival.toLowerCase().includes("insufficient")
      ? "Current visual evidence supports only a low-confidence graft survival outlook estimate."
      : `Observed implantation and density patterns appear broadly consistent with a ${esc(metrics.graftSurvival)} graft survival expectation range.`;

  const fingerprintSummary = buildSurgicalFingerprintSummary({
    areaDomains,
    sectionScores,
    findings: keyFindings,
    highlights,
    risks,
    photosByCategory,
    confidence01: confidenceNumeric,
    surgicalFingerprint: forensic?.surgical_fingerprint,
  });
  const fingerprintCards = fingerprintSummary.cards
    .map((card) => {
      const confidenceClass =
        card.confidence === "high" ? "fpPillHigh" : card.confidence === "moderate" ? "fpPillModerate" : "fpPillLow";
      const confidenceText = card.confidence.charAt(0).toUpperCase() + card.confidence.slice(1);
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
          <span class="fpPill ${confidenceClass}">${esc(confidenceText)}</span>
        </div>
        <div class="fpLabel">${esc(card.label)}</div>
        <p class="miniText"><b>AI Observation:</b> ${esc(card.observation)}</p>
        <p class="miniText"><b>Why It Matters:</b> ${esc(card.whyItMatters)}</p>
        ${card.limitation ? `<p class="miniText"><b>Limitation:</b> ${esc(card.limitation)}</p>` : ""}
        <div class="fpStrength">${stripe}</div>
      </div>`;
    })
    .join("");

  const prettyRadarLabel = (label: string): string => {
    const raw = String(label ?? "").trim();
    const lower = raw.toLowerCase();
    if (!raw) return "Domain";
    if (/surgical planning|planning|recipient site design|recipient design|recipient site/i.test(lower)) {
      return "Surgical Planning";
    }
    if (/donor|preservation|extraction/i.test(lower)) return "Donor Preservation";
    if (/graft|viability|survival|handling/i.test(lower)) return "Graft Viability";
    if (/implant|placement|angle|density|technique/i.test(lower)) return "Implantation Control";
    if (/documentation|evidence|integrity|quality/i.test(lower)) return "Documentation Integrity";
    return raw
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const radarDisplayLabels = Array.isArray(radar?.labels)
    ? radar!.labels.map((label) => prettyRadarLabel(label))
    : [];

  const radarPanel =
    radar && Array.isArray(radar.labels) && Array.isArray(radar.values) && radar.labels.length >= 3
      ? `
      <div class="radarPanel">
        <div class="panelTitle">Diagnostic Radar Signature</div>
        <div class="radarWrap">
          ${renderRadarSvg({
            labels: radarDisplayLabels,
            values: radar.values,
            size: 610,
            levels: 5,
            overall: radar.overall,
            confidence: radar.confidence,
          })}
        </div>
        <div class="miniText">Balanced performance signatures indicate consistency across key transplant domains.</div>
      </div>`
      : `<div class="radarPanel"><div class="emptyState">Radar signature unavailable for this report.</div></div>`;

  const gii = viewModelExt.graftIntegrity ?? null;
  const graftIntegrityModule = gii
    ? `
      <div class="premCard">
        <div class="premTitle">Graft Integrity Index</div>
        <div class="miniText"><b>Auditor status:</b> ${esc(String(gii.auditor_status ?? "pending"))}</div>
        <div class="miniText"><b>Claimed grafts:</b> ${gii.claimed_grafts == null ? "N/A" : esc(String(gii.claimed_grafts))}</div>
        <div class="miniText"><b>Estimated implanted:</b> ${
          gii.estimated_implanted?.min == null && gii.estimated_implanted?.max == null
            ? "N/A"
            : `${esc(String(gii.estimated_implanted?.min ?? "N/A"))} - ${esc(String(gii.estimated_implanted?.max ?? "N/A"))}`
        }</div>
        <div class="miniText"><b>Confidence:</b> ${gii.confidence_label ? esc(String(gii.confidence_label)) : "N/A"}</div>
      </div>
    `
    : "";
  const auditorModule =
    gii?.auditor_status && gii.auditor_status !== "pending"
      ? `
      <div class="premCard">
        <div class="premTitle">Human Auditor Validation</div>
        <div class="miniText">Current auditor validation status: <b>${esc(String(gii.auditor_status))}</b>.</div>
        ${
          Array.isArray(gii.limitations) && gii.limitations.length > 0
            ? `<ul class="microList">${gii.limitations.slice(0, 3).map((x) => `<li>${esc(String(x))}</li>`).join("")}</ul>`
            : `<div class="miniText">No additional auditor limitation notes were provided.</div>`
        }
      </div>
    `
      : "";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>HairAudit Report</title>

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
      --hero2: #0f2f57;
      --gold: #d5a43a;
      --gold-soft: #f6e4b8;
      --card-radius: 15px;
      --card-padding: 16px;
      --card-gap: 12px;
    }

    * { box-sizing: border-box; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 8% 12%, rgba(148, 163, 184, 0.08), transparent 38%),
        radial-gradient(circle at 90% 8%, rgba(14, 165, 233, 0.08), transparent 42%),
        linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .wrap { max-width: 910px; margin: 0 auto; padding: 0 4px; }
    .pageBreak { page-break-before: always; break-before: page; }
    h2 { page-break-after: avoid; break-after: avoid; }

    .hero {
      position: relative;
      border-radius: 18px;
      border: 1px solid rgba(160, 184, 219, 0.36);
      background:
        radial-gradient(circle at 8% 20%, rgba(45,212,191,0.28), rgba(45,212,191,0) 44%),
        radial-gradient(circle at 92% 10%, rgba(251,191,36,0.32), rgba(251,191,36,0) 46%),
        linear-gradient(140deg, #05172f 0%, #0c2f59 100%);
      color: #edf3ff;
      padding: 30px;
      page-break-inside: avoid;
      box-shadow: 0 34px 64px rgba(2, 12, 35, 0.24);
    }
    .heroTexture {
      position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
      background:
        repeating-linear-gradient(120deg, rgba(148,163,184,0.08) 0, rgba(148,163,184,0.08) 1px, transparent 1px, transparent 22px),
        radial-gradient(circle at 18% 62%, rgba(148,163,184,0.12) 0, rgba(148,163,184,0) 35%);
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
      backdrop-filter: blur(1px);
    }
    .meta b { color: #ffffff; }
    .metaRow { padding: 3px 0; border-bottom: 1px dashed rgba(203,213,225,0.25); }
    .metaRow:last-child { border-bottom: none; }

    .section {
      margin-top: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: var(--card-radius);
      background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
      page-break-inside: avoid;
      break-inside: avoid;
      box-shadow: 0 10px 26px rgba(15, 23, 42, 0.045);
    }
    .p1Section { margin-top: 32px; }
    .sectionHead {
      display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom: 10px;
      page-break-after: avoid; break-after: avoid;
    }
    .sectionHead h2 { margin: 0; font-size: 19px; letter-spacing: -0.01em; line-height: 1.2; }
    .sectionDivider { height: 1px; margin: 10px 0 12px; background: linear-gradient(90deg, rgba(182,201,228,0.65), rgba(182,201,228,0.08)); }
    .pillRow { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

    .pill {
      display:inline-flex; gap:6px; align-items:center;
      padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--line-strong); background: #fff;
      font-size: 11px; color: var(--muted);
    }
    .pill b { color: var(--ink); }

    .p1Section .sectionHead { margin-bottom: 12px; }
    .p1Section .sectionDivider { margin-bottom: 0; }
    .p1Zone {
      position: relative;
      overflow: hidden;
      margin-top: 32px;
      margin-bottom: 28px;
      border: 1px solid rgba(182, 201, 228, 0.55);
      border-radius: 18px;
      padding: 32px;
      background:
        radial-gradient(circle at 15% 8%, rgba(191,219,254,0.28), rgba(191,219,254,0) 45%),
        radial-gradient(circle at 68% 18%, rgba(14,165,233,0.11), rgba(14,165,233,0) 42%),
        repeating-linear-gradient(120deg, rgba(148,163,184,0.05) 0, rgba(148,163,184,0.05) 1px, transparent 1px, transparent 22px),
        linear-gradient(180deg, #fafdff 0%, #f2f7ff 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 18px 36px rgba(15,23,42,0.07);
    }
    .p1Zone::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 18% 26%, rgba(250,204,21,0.12), rgba(250,204,21,0) 32%),
        radial-gradient(circle at 70% 20%, rgba(56,189,248,0.10), rgba(56,189,248,0) 36%);
      opacity: .85;
    }
    .heroDashboard {
      position: relative;
      z-index: 1;
      border: 1px solid rgba(198, 214, 236, 0.6);
      border-radius: 18px;
      padding: 18px;
      background:
        radial-gradient(circle at 12% 16%, rgba(148,163,184,0.08), rgba(148,163,184,0) 38%),
        linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(244,250,255,0.88) 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.92);
    }
    .execLayout { position: relative; z-index: 1; display: grid; grid-template-columns: 1.24fr 1fr; gap: 26px; align-items: stretch; }
    .scoreBadge {
      position: relative;
      border: 1px solid rgba(213, 164, 58, 0.45);
      border-radius: 24px;
      padding: 32px;
      margin-right: 0;
      background:
        radial-gradient(circle at 16% 8%, rgba(251, 191, 36, 0.36), rgba(251,191,36,0) 50%),
        radial-gradient(circle at 88% 18%, rgba(148, 163, 184, 0.24), rgba(148,163,184,0) 48%),
        linear-gradient(155deg, #ffffff 0%, #e6f0ff 100%);
      min-height: 480px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 24px 48px rgba(213, 164, 58, 0.22), 0 14px 30px rgba(15,23,42,0.1);
    }
    .scoreBadge::after {
      content: "";
      position: absolute;
      inset: 1px;
      border-radius: 23px;
      pointer-events: none;
      background: linear-gradient(165deg, rgba(255,255,255,0.48), rgba(255,255,255,0) 50%);
    }
    .scoreLabel { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #556685; font-weight: 700; }
    .scoreBubble {
      width: 278px; height: 278px; border-radius: 999px;
      display:flex; align-items:center; justify-content:center; flex-direction: column;
      border: 1px solid rgba(213,164,58,0.45);
      background: radial-gradient(circle at 30% 20%, #ffffff 0%, #dbe9fb 100%);
      box-shadow: inset 0 0 0 8px rgba(255,255,255,0.78), 0 22px 42px rgba(15,23,42,.14), 0 0 36px rgba(213,164,58,.3);
    }
    .scoreValue { font-size: 92px; font-weight: 900; line-height: 1; letter-spacing: -0.05em; color: #061733; }
    .scoreSub { font-size: 10px; color: #4e678b; margin-top: 6px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
    .tierTag {
      margin-top: 14px; display: inline-flex; padding: 9px 14px; border-radius: 999px;
      border: 1px solid rgba(213,164,58,.55); font-size: 11px; font-weight: 800; background: var(--gold-soft);
    }
    .scoreConfLine { margin-top: 16px; font-size: 11px; color: #2b4a72; line-height: 1.65; max-width: 93%; font-weight: 600; }
    .p1RightCol { display: flex; flex-direction: column; height: 100%; min-height: 480px; }
    .keyMetricCard { margin-top: 24px; position: relative; z-index: 1; }

    .metricCard, .panelCard { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background:#fff; }
    .metricTitle, .panelTitle { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
    .metricList { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .metricList div { display:flex; justify-content:space-between; gap:10px; font-size: 11px; flex-wrap: wrap; }
    .metricList span { color: var(--muted); }
    .metricList b { color: var(--ink); word-break: break-word; overflow-wrap: break-word; max-width: 65%; text-align: right; }
    .radarPanel {
      margin-top: 0;
      margin-bottom: 0;
      border: 1px solid #e6edf3;
      border-radius: 12px;
      padding: 32px;
      background:
        radial-gradient(circle at 22% 14%, rgba(14,165,233,0.08), rgba(14,165,233,0) 45%),
        linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      page-break-inside: avoid;
      break-inside: avoid;
      box-shadow: 0 14px 30px rgba(15,23,42,0.08);
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      min-height: 480px;
    }
    .radarWrap {
      margin-top: 18px;
      display: flex;
      justify-content: center;
      page-break-inside: avoid;
      break-inside: avoid;
      min-height: 520px;
      align-items: center;
      padding: 18px;
    }
    .radarWrap svg { display: block; margin: 0 auto; max-width: 94%; height: auto; border-radius: 12px; border: 1px solid rgba(14,165,233,0.15); }
    .radarPanel .miniText { margin-top: 20px; margin-bottom: 10px; }
    .infoGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 26px; align-items: stretch; }
    .p1Zone .panelCard {
      box-shadow: 0 6px 16px rgba(15,23,42,0.03);
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border: 1px solid #e6edf3;
      border-radius: 14px;
      padding: 22px;
      min-height: 224px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    .p1Zone .panelTitle { margin-bottom: 12px; }
    .kpiValue { font-size: 34px; font-weight: 900; letter-spacing: -0.02em; color: #0f2344; margin-top: 6px; line-height: 1.05; }
    .kpiSub { font-size: 11px; color: #4e678b; margin-top: 6px; }
    .kpiList { margin: 11px 0 0; padding-left: 18px; }
    .kpiList li { margin: 3px 0; font-size: 11px; color: #112545; }
    .riskStrip { margin-top: 22px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
    .riskPill {
      padding: 14px 16px; border-radius: 12px; font-size: 8.5px; border: 1px solid transparent; font-weight: 700;
      display:flex; flex-direction:column; gap:4px;
      line-height: 1.35;
    }
    .riskPill b { font-size: 14px; line-height: 1.1; letter-spacing: -0.01em; }
    .riskPill.good { background: #ecfdf5; border-color: #a7f3d0; color: #166534; }
    .riskPill.watch { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
    .riskPill.note { background: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
    .executiveDivider {
      border-top: 1px solid #e6edf3;
      margin-top: 28px;
      margin-bottom: 18px;
      height: 0;
      background: none;
    }
    .summaryCard { margin-top: 0; border: 1px solid var(--line); border-radius: 14px; padding: 22px; background: #fff; }
    .summaryCard .panelTitle { font-size: 12.5px; color: #385173; margin-bottom: 12px; }
    .summaryCard .miniText { font-size: 13px; line-height: 1.65; max-width: 700px; color: #102543; }

    .domainGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
    .domainCard { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
    .domainAlt { background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%); }
    .domainTop { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
    .domainTop h3 { margin:0; font-size: 14px; }
    .domainScoreValue { font-size: 12px; font-weight: 800; color: #0f172a; white-space: nowrap; }
    .bar { margin-top: 8px; height: 8px; background: #e7edf6; border-radius: 999px; overflow: hidden; }
    .barFill { height: 100%; border-radius: 999px; }
    .barFill.high { background: #059669; }
    .barFill.medium { background: #d97706; }
    .barFill.low { background: #64748b; }
    .microTitle { margin-top: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #637793; font-weight: 800; }
    .microList { margin: 6px 0 0; padding-left: 17px; }
    .microList li { margin: 4px 0; font-size: 11px; color: #11223a; }

    /* ---------- Visual Evidence Analysis (Photo Evidence) ---------- */
    .evidenceSectionTitle { font-size: 20px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 4px 0; }
    .evidenceSectionSubtitle { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 0 0 16px 0; }
    .forensicBoard {
      position: relative;
      border: 1px solid var(--line-strong);
      border-radius: 16px;
      padding: 20px;
      background:
        repeating-linear-gradient(0deg, transparent 0, transparent 22px, rgba(148,163,184,0.03) 22px, rgba(148,163,184,0.03) 23px),
        repeating-linear-gradient(90deg, transparent 0, transparent 22px, rgba(148,163,184,0.03) 22px, rgba(148,163,184,0.03) 23px),
        linear-gradient(180deg, #ffffff 0%, #f8fbff 50%, #f2f7ff 100%);
      page-break-inside: avoid;
      break-inside: avoid;
      box-shadow: 0 6px 20px rgba(15,23,42,0.06);
    }
    .evidenceGroup {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid rgba(148,163,184,0.25);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .evidenceGroup:first-child { margin-top: 0; padding-top: 0; border-top: none; }
    .evidenceGroupHead {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(148,163,184,0.18);
    }
    .evidenceGroupIcon { width: 28px; height: 28px; border-radius: 8px; background: rgba(14,165,233,0.12); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #0369a1; }
    .evidenceGroupTitle { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #0f2344; }
    .evidencePhotoGrid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-top: 12px;
    }
    .evidencePhotoGrid.single { grid-template-columns: 1fr; justify-items: center; max-width: 360px; margin-left: auto; margin-right: auto; }
    .evidencePhotoCard {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 4px 12px rgba(15,23,42,0.04);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .evidencePhotoCard .imgWrap {
      position: relative;
      background: #f1f5f9;
      padding: 6px;
      border-bottom: 1px solid rgba(203,213,225,0.6);
    }
    .evidencePhotoCard img { display: block; width: 100%; height: 160px; object-fit: cover; border-radius: 8px; }
    .evidencePhotoCard .imgLabel {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
      padding: 8px 10px 6px;
      background: #f9fbff;
      border-top: 1px solid rgba(203,213,225,0.5);
      min-height: 32px;
    }
    .evidenceObsPanel {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(191,219,254,0.6);
      background: linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%);
      font-size: 11px;
      line-height: 1.55;
      color: #1e3a8a;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .evidenceObsRow { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
    .evidenceObsRow:last-child { margin-bottom: 0; }
    .evidenceConfPill {
      flex-shrink: 0;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .evidenceConfPill.high { background: #dcfce7; color: #166534; border-color: #86efac; }
    .evidenceConfPill.moderate { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .evidenceConfPill.limited { background: #e2e8f0; color: #334155; border-color: #cbd5e1; }
    .evidenceLimitationsPanel {
      margin-top: 20px;
      padding: 14px 16px;
      border: 1px solid rgba(148,163,184,0.35);
      border-radius: 12px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      font-size: 11px;
      line-height: 1.55;
      color: #334155;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .evidenceLimitationsPanel .panelLabel { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: 6px; }
    .forensicGrid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 8px; }
    .forensicPhoto {
      margin:0; border: 1px solid var(--line); border-radius: 12px; overflow:hidden; background:#fff;
      box-shadow: 0 4px 12px rgba(15,23,42,0.04);
      page-break-inside: avoid; break-inside: avoid;
    }
    .forensicPhoto img { display:block; width:100%; height:160px; object-fit:cover; }
    .forensicPhoto figcaption { font-size:10px; color: var(--muted); padding:8px 10px; min-height: 32px; background: #f9fbff; border-top: 1px solid rgba(203,213,225,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .limitPanel { margin-top: 12px; border: 1px solid #bfdbfe; border-radius: 12px; padding: 10px; background: #eff6ff; font-size: 11px; color: #1e3a8a; }

    .premiumGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .premCard {
      border: 1px solid #d4d4f9; border-radius: 12px; padding: 12px; background: linear-gradient(180deg, #ffffff 0%, #f8f5ff 100%);
      page-break-inside: avoid; break-inside: avoid;
    }
    .premTitle { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #4338ca; margin-bottom: 6px; }
    .fingerprintSection {
      margin-top: 12px; border: 1px solid #bae6fd; border-radius: 14px; padding: 12px; background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%);
      page-break-inside: avoid; break-inside: avoid;
    }
    .fpGrid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .fpCard { border: 1px solid #dbeafe; border-radius: 12px; padding: 10px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
    .fpHead { display:flex; justify-content:space-between; align-items:center; gap: 8px; }
    .fpTitleWrap { display:flex; align-items:center; gap: 6px; }
    .fpTitleWrap h4 { margin:0; font-size: 12px; }
    .fpIcon { width: 20px; height: 20px; border-radius: 999px; border: 1px solid var(--line); display:inline-flex; align-items:center; justify-content:center; font-size: 11px; }
    .fpPill { font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 8px; border: 1px solid transparent; }
    .fpPillHigh { background: #dcfce7; color: #166534; border-color: #86efac; }
    .fpPillModerate { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .fpPillLow { background: #e2e8f0; color: #334155; border-color: #cbd5e1; }
    .fpLabel { margin-top: 6px; font-size: 12px; font-weight: 800; color: #0f172a; }
    .fpStrength { margin-top: 8px; display:flex; gap: 4px; }
    .fpDot { width: 14px; height: 5px; border-radius: 999px; background: #e2e8f0; }
    .fpDot.active { background: #38bdf8; }

    .twoCol { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .listCard { border: 1px solid var(--line); border-radius: var(--card-radius); padding: var(--card-padding); background:#fff; page-break-inside: avoid; break-inside: avoid; }
    .listTitle { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .listCard ul { margin: 0; padding-left: 18px; }
    .listCard li { font-size: 11px; color: var(--ink); margin: 6px 0; }
    .wrapText { word-break: break-word; overflow-wrap: break-word; }
    .iconPositive { color: #15803d; }
    .iconWatch { color: #b45309; }
    .iconGuide { color: #1d4ed8; }
    .iconOutlook { color: #6d28d9; }
    .emptyState { font-size: 11px; color: var(--muted); border: 1px dashed #cbd5e1; border-radius: 10px; padding: 10px; background: #fff; }
    .miniText { margin-top: 6px; font-size: 11px; color: var(--ink); line-height: 1.5; }
    p, li { orphans: 3; widows: 3; }
    .footer {
      margin-top: 18px;
      font-size: 10px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .footerDebug {
      margin-top: 4px;
      font-size: 10px;
      color: var(--muted);
    }

    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    @media print {
      .wrap { padding: 0; }
      .hero { padding: 24px; break-inside: avoid; }
      .section { margin-top: 14px; padding: 12px; }
      .domainGrid, .forensicGrid, .premiumGrid, .fpGrid { grid-template-columns: 1fr; }
      .fpGrid { grid-template-columns: 1fr; }
      .p1Section { margin-top: 26px; }
      .p1Zone { margin-top: 26px; margin-bottom: 24px; padding: 22px; }
      .heroDashboard { padding: 14px; }
      .execLayout { grid-template-columns: 1.18fr 1fr; gap: 24px; }
      .scoreBadge { min-height: 390px; padding: 24px; }
      .scoreBubble { width: 220px; height: 220px; }
      .scoreValue { font-size: 72px; }
      .p1RightCol { min-height: 390px; }
      .radarPanel { margin-top: 0; padding: 26px; min-height: 390px; }
      .radarWrap { min-height: 400px; padding: 12px; }
      .keyMetricCard { margin-top: 18px; }
      .infoGrid { grid-template-columns: 1fr 1fr; }
      .infoGrid { margin-top: 24px; gap: 16px; }
      .riskStrip { grid-template-columns: 1fr 1fr; margin-top: 22px; gap: 12px; }
      .executiveDivider { margin-top: 0; margin-bottom: 18px; }
      .forensicPhoto img, .evidencePhotoCard img { height: 140px; }
      .evidenceGroup, .evidenceObsPanel, .evidenceLimitationsPanel, .evidencePhotoCard { break-inside: avoid; page-break-inside: avoid; }
      .evidencePhotoGrid { gap: 10px; }
      .footer { page-break-inside: avoid; margin-top: 14px; padding-top: 6px; }
      .sectionDivider { margin: 8px 0 10px; }
      .domainCard, .listCard, .forensicPhoto, .premCard, .fpCard, .radarPanel, .fingerprintSection, .photoGroup { break-inside: avoid-page; page-break-inside: avoid; }
    }
  </style>
</head>

<body>
  <div class="wrap">

    <div class="hero">
      <div class="heroTexture"></div>
      <div class="topbar">
        <div class="brand">
          <h1 class="title">HairAudit AI Surgical Analysis</h1>
          <div class="heroSubtitle">AI-Assisted Transplant Quality Review</div>
        </div>
        <div class="meta">
          <div class="metaRow"><b>Case ID</b> <span class="mono">${esc(caseId)}</span></div>
          <div class="metaRow"><b>Report Date</b> ${esc(generatedAt)}</div>
          <div class="metaRow"><b>Model Version</b> ${esc(modelVersion || "N/A")}</div>
          <div class="metaRow"><b>Confidence Label</b> ${esc(confidenceBand)}</div>
        </div>
      </div>
    </div>

    <div class="section p1Section">
      <div class="sectionHead">
        <h2>Executive Intelligence Summary</h2>
        <div class="pillRow">
          <span class="pill">Overall Surgical Quality Score</span>
          ${
            version
              ? `<span class="pill">Report: <b>v${esc(String(version))}</b></span>`
              : `<span class="pill">Report: <b>—</b></span>`
          }
        </div>
      </div>
      <div class="sectionDivider"></div>

      <div class="p1Zone">
        <div class="heroDashboard">
          <div class="execLayout">
          <div class="scoreBadge">
            <div class="scoreLabel">Overall Surgical Quality Score</div>
            <div class="scoreBubble">
              <div class="scoreValue">${overallScore === null ? "—" : esc(String(overallScore))}</div>
              <div class="scoreSub">out of 100</div>
            </div>
            <div class="tierTag" style="background:${scoreBand.color};">Tier: ${esc(scoreBand.label)}</div>
            <div class="scoreConfLine">${esc(scoreConfLine)}</div>
          </div>

          <div class="p1RightCol">
            ${radarPanel}
          </div>
          </div>
        </div>

        <div class="metricCard keyMetricCard">
          <div class="metricTitle">Key Metrics</div>
          <div class="metricList">
            <div><span>Donor quality</span><b>${esc(metrics.donorQuality)}</b></div>
            <div><span>Survival estimate</span><b>${esc(metrics.graftSurvival)}</b></div>
            <div><span>Transection risk</span><b>${esc(metrics.transectionRisk)}</b></div>
            <div><span>Implant density</span><b>${esc(metrics.implantationDensity)}</b></div>
            <div><span>Hairline naturalness</span><b>${esc(metrics.hairlineNaturalness)}</b></div>
            <div><span>Donor scar visibility</span><b>${esc(metrics.donorScarVisibility)}</b></div>
          </div>
        </div>

        <div class="infoGrid">
          <div class="panelCard">
            <div class="panelTitle">AI Confidence</div>
            <div class="kpiValue">${esc(confidenceScorePct)}</div>
            <div class="kpiSub">${esc(confidenceBand)} confidence band</div>
            <div class="miniText">Confidence reflects visual evidence clarity and completeness across submitted documentation.</div>
          </div>
          <div class="panelCard">
            <div class="panelTitle">Data Integrity</div>
            <div class="kpiValue">${allPhotos.length}</div>
            <div class="kpiSub">images analyzed</div>
            <ul class="kpiList">
              <li>Donor views: ${donorViews}</li>
              <li>Recipient views: ${recipientViews}</li>
              <li>Intra-operative images: ${intraViews}</li>
              <li>Missing categories: ${missingCats.length > 0 ? esc(missingCats.join(", ")) : "None reported"}</li>
            </ul>
            <div class="miniText">Evidence completeness: ${allPhotos.length >= 6 ? "sufficient for broader interpretation." : "limited for high-confidence interpretation."}</div>
          </div>
        </div>
        ${riskStrip}
      </div>

      <div class="executiveDivider"></div>
      <div class="summaryCard">
        <div class="panelTitle">Executive AI Summary</div>
        <div class="miniText">${esc(executiveSummary)}</div>
      </div>
      ${
        limitationNotes.length > 0
          ? `<div class="limitPanel"><b>Evidence limitations:</b> ${esc(limitationNotes.slice(0, 3).join(" | "))}</div>`
          : ""
      }
    </div>

    <div class="section pageBreak">
      <div class="sectionHead">
        <h2>Section-by-Section Analysis</h2>
        <span class="pill">Clinical intelligence cards</span>
      </div>
      <div class="sectionDivider"></div>
      <div class="domainGrid">${domainCards}</div>
    </div>

    <div class="section pageBreak">
      <div class="sectionHead">
        <div>
          <h2 class="evidenceSectionTitle">Visual Evidence Analysis</h2>
          <div class="evidenceSectionSubtitle">AI-assisted review of donor, recipient, and procedural image documentation.</div>
        </div>
        <span class="pill">Forensic evidence board</span>
      </div>
      <div class="sectionDivider"></div>
      <div class="forensicBoard">${photoGroups}</div>
      <div class="evidenceLimitationsPanel">
        <div class="panelLabel">Evidence Limitations</div>
        ${
          allPhotos.length === 0
            ? "Limited visual evidence was available for image-level interpretation."
            : allPhotos.length >= 6 && missingCats.length === 0
              ? "Available images provide moderate to strong coverage of the donor and recipient areas. Further intra-operative documentation may improve assessment depth for graft handling practices."
              : `Available images provide ${allPhotos.length >= 4 ? "moderate" : "limited"} coverage of the donor and recipient areas.${missingCats.length ? ` Limited ${esc(missingCats.join(", "))} documentation prevents deeper assessment in some domains.` : " Limited intra-operative documentation may constrain graft handling evaluation."}`
        }
      </div>
    </div>

    <div class="section pageBreak">
      <div class="sectionHead">
        <h2>Findings, Recommendations, and Premium Layers</h2>
        <span class="pill">Conclusive intelligence view</span>
      </div>
      <div class="sectionDivider"></div>
      ${(graftIntegrityModule || auditorModule) ? `<div class="premiumGrid">${graftIntegrityModule}${auditorModule}</div>` : ""}
      <div class="fingerprintSection">
        <div class="panelTitle">AI Surgical Fingerprint Analysis</div>
        <div class="miniText">Pattern-based visual review of extraction, implantation, spacing, and density consistency.</div>
        <div class="fpGrid">${fingerprintCards}</div>
        ${
          fingerprintSummary.limitedEvidence
            ? `<div class="limitPanel"><b>Evidence note:</b> Pattern interpretation is limited by available image quality or angle coverage in one or more domains.</div>`
            : ""
        }
      </div>
      <div class="twoCol">
        <div class="listCard">
          <div class="listTitle"><span class="iconPositive">●</span> Key Positive Indicators</div>
          ${
            highlights.length > 0
              ? `<ul>${highlights.map((x) => `<li class="wrapText">✔ ${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">No strong indicators identified with high confidence.</div>`
          }
        </div>
        <div class="listCard">
          <div class="listTitle"><span class="iconWatch">●</span> Areas Requiring Review</div>
          ${
            risks.length > 0
              ? `<ul>${risks.map((x) => `<li class="wrapText">⚠ ${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">No major concerns flagged from current evidence.</div>`
          }
        </div>
      </div>
      <div class="listCard" style="margin-top:12px;">
        <div class="listTitle"><span class="iconGuide">●</span> Patient Guidance</div>
        <ul>${patientGuidance.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="listCard" style="margin-top:12px;">
        <div class="listTitle"><span class="iconOutlook">●</span> Predictive Outlook</div>
        <div class="miniText">${predictiveOutlook}</div>
      </div>
      ${
        narrativeText.length > 0
          ? `<div class="listCard" style="margin-top:12px;"><div class="listTitle">Clinical Narrative</div><div class="miniText">${esc(narrativeText).replaceAll("\n", "<br/>")}</div></div>`
          : ""
      }
    </div>

    ${(vm.viewModel.auditMode === "doctor" || vm.viewModel.auditMode === "auditor") && doctorBlockHtml ? doctorBlockHtml : ""}

    <div class="footer">
      This report provides an AI-assisted visual assessment based on the submitted images and available metadata.
      It does not represent a definitive graft count or medical diagnosis.
      ${typeof debugFooter === "string" && debugFooter.trim().length > 0 ? `<div class="footerDebug">${debugFooter}</div>` : ""}
    </div>

  </div>
</body>
</html>`;

  return html;
}

