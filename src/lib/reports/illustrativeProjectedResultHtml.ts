/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — PDF HTML for Illustrative Projected Result.
 */

import type { IllustrativeProjectedResultSection } from "@/lib/preSurgeryIntelligence/reportProjectionInclusion";
import { PROJECTION_ASSET_FALLBACK_NOTICE } from "@/lib/preSurgeryIntelligence/reportProjectionCopy";

export type IllustrativeProjectionHtmlMedia = {
  sourceImageUrl: string | null;
  projectedImageUrl: string | null;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const ILLUSTRATIVE_PROJECTED_RESULT_CSS = `
    .projResult { border-color: #bfdbfe; background: #f8fbff; }
    .projIntro { margin: 10px 0 0; color: #334155; font-size: 11px; line-height: 1.55; }
    .projLimitPanel {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 2px solid #f59e0b;
      background: #fffbeb;
      color: #78350f;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.5;
    }
    .projMetaGrid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin-top: 12px;
      font-size: 10px;
    }
    .projMetaLabel { color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 9px; }
    .projMetaValue { margin-top: 2px; color: #0f172a; font-weight: 600; }
    .projCompare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }
    .projImgCard {
      border: 1px solid #d5e2f2;
      border-radius: 12px;
      overflow: hidden;
      background: #f1f5f9;
    }
    .projImgCard img {
      width: 100%;
      height: 200px;
      object-fit: contain;
      object-position: center;
      display: block;
      background: #e2e8f0;
    }
    .projImgFallback {
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      text-align: center;
      color: #64748b;
      font-size: 10px;
    }
    .projImgCap {
      padding: 8px 10px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      border-top: 1px solid #e2e8f0;
      background: #fff;
    }
    .projList { margin: 8px 0 0; padding-left: 16px; color: #334155; }
    .projList li { margin-bottom: 4px; }
    .projOmit { margin-top: 8px; color: #475569; font-size: 11px; }
    @media print {
      .projCompare { page-break-inside: avoid; }
      .projLimitPanel { page-break-inside: avoid; }
    }
`;

export function renderIllustrativeProjectedResultHtml(input: {
  section: IllustrativeProjectedResultSection | null | undefined;
  media?: IllustrativeProjectionHtmlMedia | null;
}): string {
  const section = input.section;
  if (!section) return "";

  if (!section.showImagery || section.inclusionState !== "approved_for_inclusion") {
    if (!section.omitExplanation) return "";
    return `
    <div class="section projResult" data-testid="illustrative-projected-result-pdf" data-inclusion="${esc(section.inclusionState)}">
      <div class="sectionHead"><h2>${esc(section.title)}</h2></div>
      <p class="projOmit">${esc(section.omitExplanation)}</p>
    </div>`;
  }

  const media = input.media ?? null;
  const sourceUrl = media?.sourceImageUrl ?? null;
  const projectedUrl = media?.projectedImageUrl ?? null;
  const assetFailed = !sourceUrl && !projectedUrl;

  const zones = section.modelledTreatmentZones
    .filter((z) => z.priority !== "defer")
    .map((z) => `<li>${esc(z.zone)}${z.grafts != null ? ` — ${z.grafts} grafts` : ""}</li>`)
    .join("");

  const deferred =
    section.deferredZones.length > 0
      ? section.deferredZones.map((z) => `<li>${esc(z)} (deferred)</li>`).join("")
      : "<li>None deferred</li>";

  const assumptions = section.keyAssumptions.map((a) => `<li>${esc(a)}</li>`).join("");
  const limitations = section.caseSpecificLimitations.map((a) => `<li>${esc(a)}</li>`).join("");

  const graft =
    section.provisionalGraftRange != null
      ? `${section.provisionalGraftRange.min}–${section.provisionalGraftRange.max} grafts (provisional)`
      : "Not stated";

  return `
    <div class="section projResult" data-testid="illustrative-projected-result-pdf" data-inclusion="approved_for_inclusion">
      <div class="sectionHead"><h2>${esc(section.title)}</h2></div>
      <p class="projIntro">${esc(section.intro)}</p>
      <div class="projLimitPanel">${esc(section.limitationPanel)}</div>
      ${
        assetFailed
          ? `<p class="projOmit">${esc(PROJECTION_ASSET_FALLBACK_NOTICE)}</p>`
          : `<div class="projCompare">
        <div class="projImgCard">
          ${
            sourceUrl
              ? `<img src="${esc(sourceUrl)}" alt="Original planning photograph" />`
              : `<div class="projImgFallback">${esc(PROJECTION_ASSET_FALLBACK_NOTICE)}</div>`
          }
          <div class="projImgCap">Submitted source</div>
        </div>
        <div class="projImgCard">
          ${
            projectedUrl
              ? `<img src="${esc(projectedUrl)}" alt="Illustrative Surgery Plan" />`
              : `<div class="projImgFallback">${esc(PROJECTION_ASSET_FALLBACK_NOTICE)}</div>`
          }
          <div class="projImgCap">Illustrative Surgery Plan</div>
        </div>
      </div>`
      }
      <div class="projMetaGrid">
        <div>
          <div class="projMetaLabel">Planning mode</div>
          <div class="projMetaValue">${esc(section.planningModeLabel ?? section.patientSafeLabel ?? "")}</div>
        </div>
        <div>
          <div class="projMetaLabel">Provisional graft range</div>
          <div class="projMetaValue">${esc(graft)}</div>
        </div>
        <div>
          <div class="projMetaLabel">Snapshot</div>
          <div class="projMetaValue">${esc(section.snapshotVersionLabel ?? "")}</div>
        </div>
        <div>
          <div class="projMetaLabel">Approval</div>
          <div class="projMetaValue">${esc(
            [section.approvalDate ? section.approvalDate.slice(0, 10) : null, section.reviewerAttribution]
              .filter(Boolean)
              .join(" · ") || "Clinician approved"
          )}</div>
        </div>
      </div>
      <div style="margin-top:12px;">
        <div class="projMetaLabel">Modelled treatment zones</div>
        <ul class="projList">${zones || "<li>See planning summary</li>"}</ul>
      </div>
      <div style="margin-top:10px;">
        <div class="projMetaLabel">Deferred or excluded zones</div>
        <ul class="projList">${deferred}</ul>
      </div>
      <div style="margin-top:10px;">
        <div class="projMetaLabel">Key assumptions</div>
        <ul class="projList">${assumptions || "<li>Illustrative planning aid only</li>"}</ul>
      </div>
      <div style="margin-top:10px;">
        <div class="projMetaLabel">Additional limitations</div>
        <ul class="projList">${limitations}</ul>
      </div>
    </div>`;
}
