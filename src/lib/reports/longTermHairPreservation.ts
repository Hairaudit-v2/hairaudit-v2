/**
 * HA-REPORT-5B — Long-Term Hair Preservation Strategy (patient-safe educational content).
 */

import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

export type LongTermPreservationSubsectionId =
  | "medical"
  | "natural"
  | "regenerative"
  | "monitoring";

export type LongTermPreservationSubsection = {
  id: LongTermPreservationSubsectionId;
  title: string;
  intro: string;
  examples: string[];
  explanation: string;
};

export type LongTermHairPreservationContent = {
  title: string;
  pathwayContext: string;
  introParagraphs: string[];
  subsections: LongTermPreservationSubsection[];
  safetyStatement: string;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const LONG_TERM_PRESERVATION_CSS = `
  .preservationSection { background: #f0f9ff; border-color: #bae6fd; }
  .preservationPathway { margin: 8px 0 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0369a1; }
  .preservationIntro { margin: 10px 0 0; color: #334155; max-width: 72ch; }
  .preservationSubsection {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #dbeafe;
  }
  .preservationSubsection:first-of-type { border-top: none; padding-top: 0; }
  .preservationSubsection h3 { margin: 0; font-size: 12px; font-weight: 800; color: var(--ink); }
  .preservationSubsection p { margin: 6px 0 0; color: #334155; max-width: 72ch; }
  .preservationExamples { margin: 8px 0 0; padding-left: 18px; color: #334155; }
  .preservationExamples li { margin-bottom: 4px; }
  .preservationSafety {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #fcd34d;
    background: #fffbeb;
    color: #78350f;
    font-size: 10px;
    line-height: 1.5;
  }
  .certificationSection { page-break-before: auto; }
`;

export function buildLongTermHairPreservationContent(
  pathway: PatientReviewPathway
): LongTermHairPreservationContent {
  const pathwayContext =
    pathway === "pre_surgery"
      ? "Planning future long-term preservation"
      : "Protecting your post-transplant result";

  const regenerativeIntro =
    pathway === "pre_surgery"
      ? "Some patients explore supportive regenerative therapies as part of long-term maintenance planning before or alongside surgical treatment."
      : "Some patients choose supportive regenerative therapies following transplantation as part of long-term maintenance planning.";

  return {
    title: "Long-Term Hair Preservation Strategy",
    pathwayContext,
    introParagraphs: [
      "Hair transplantation restores areas affected by hair loss, but it does not prevent the continued progression of future thinning in surrounding native hair.",
      "Protecting existing hair remains one of the most important parts of long-term planning and may reduce the need for future surgery.",
    ],
    subsections: [
      {
        id: "medical",
        title: "Medical Hair Loss Prevention Options",
        intro:
          "Some patients experiencing androgenetic hair loss may benefit from medical therapies designed to reduce ongoing follicular miniaturisation and preserve surrounding native hair.",
        examples: ["Finasteride", "Dutasteride"],
        explanation:
          "These medications may reduce the effects of DHT-related hair loss progression and help stabilise existing hair density over time.",
      },
      {
        id: "natural",
        title: "Natural Hair Preservation Support",
        intro:
          "Some patients explore natural support therapies as part of a broader long-term hair preservation strategy.",
        examples: [
          "Saw Palmetto",
          "Nutritional optimisation",
          "Iron deficiency correction where clinically indicated",
          "Vitamin and mineral support",
          "Scalp inflammation management",
        ],
        explanation:
          "Supporting scalp health and correcting nutritional deficiencies may contribute to maintaining healthier long-term hair quality in some patients.",
      },
      {
        id: "regenerative",
        title: "Regenerative Hair Support Options",
        intro: regenerativeIntro,
        examples: [
          "PRP (Platelet Rich Plasma)",
          "Exosome therapy",
          "Microneedling",
          "Low-level laser therapy",
        ],
        explanation:
          "These therapies are sometimes explored to support scalp health and improve the environment surrounding existing native hair follicles.",
      },
      {
        id: "monitoring",
        title: "Monitoring Future Hair Loss Progression",
        intro:
          "Even when transplanted grafts remain permanent, surrounding non-transplanted native hair may continue progressive thinning over time.",
        examples: [
          "Crown density changes",
          "Mid-scalp thinning progression",
          "Temporal recession progression",
          "Overall hair calibre reduction",
          "Progressive donor reserve depletion if future surgery is considered",
        ],
        explanation:
          "Ongoing monitoring may allow earlier intervention before significant visible progression occurs.",
      },
    ],
    safetyStatement:
      "Before beginning any medication, supplement, or regenerative treatment, these options should always be discussed with your GP, prescribing doctor, or qualified treating clinician. HairAudit provides educational guidance only and does not prescribe treatment.",
  };
}

export function isLongTermHairPreservationContent(
  value: unknown
): value is LongTermHairPreservationContent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as LongTermHairPreservationContent;
  return (
    typeof v.title === "string" &&
    typeof v.pathwayContext === "string" &&
    Array.isArray(v.introParagraphs) &&
    Array.isArray(v.subsections) &&
    typeof v.safetyStatement === "string"
  );
}

export function renderLongTermHairPreservationHtml(
  content: LongTermHairPreservationContent
): string {
  const introHtml = content.introParagraphs
    .map((p) => `<p class="preservationIntro">${esc(p)}</p>`)
    .join("");

  const subsectionsHtml = content.subsections
    .map((sub) => {
      const examplesLabel =
        sub.id === "monitoring"
          ? "Patients should continue monitoring:"
          : sub.id === "medical"
            ? "Examples that may be discussed with a qualified doctor include:"
            : sub.id === "natural"
              ? "Examples may include:"
              : "Examples include:";
      return `
      <div class="preservationSubsection">
        <h3>${esc(sub.title)}</h3>
        <p>${esc(sub.intro)}</p>
        <p class="preservationIntro" style="margin-top:8px;font-size:10px;color:var(--muted);">${esc(examplesLabel)}</p>
        <ul class="preservationExamples">
          ${sub.examples.map((ex) => `<li>${esc(ex)}</li>`).join("")}
        </ul>
        <p>${esc(sub.explanation)}</p>
      </div>`;
    })
    .join("");

  return `
    <div class="section preservationSection">
      <div class="sectionHead"><h2>${esc(content.title)}</h2></div>
      <p class="preservationPathway">${esc(content.pathwayContext)}</p>
      ${introHtml}
      ${subsectionsHtml}
      <div class="preservationSafety">${esc(content.safetyStatement)}</div>
    </div>`;
}
