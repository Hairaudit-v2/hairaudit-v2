/**
 * HairAudit platform engineering progress — manually editable source of truth.
 * Update completion percentages, stages, statuses, and changelog entries here.
 */

export type ModuleStatus =
  | "Live"
  | "Production"
  | "Pilot Ready"
  | "Active Development"
  | "Infrastructure Complete";

export type IntelligenceModule = {
  id: string;
  name: string;
  /** 0–100 — edit directly when progress changes */
  completionPercent: number;
  stage: string;
  description: string;
  status: ModuleStatus;
};

export type PatientUxFeature = {
  id: string;
  name: string;
  /** 0–100 — edit directly when progress changes */
  completionPercent: number;
  description: string;
  focus: string;
};

export type EngineeringChangelogEntry = {
  date: string;
  title: string;
  description: string;
  area: "Intelligence" | "Patient Experience" | "Infrastructure" | "Platform";
};

export const PLATFORM_MISSION = {
  headline: "Building independent intelligence infrastructure for global hair restoration transparency.",
  body: "HairAudit is engineering the world's first independent intelligence infrastructure for global hair restoration transparency — structured evidence review, procedural analytics, and outcome signals that operate outside clinic marketing and referral economics.",
  principles: [
    "Evidence-first review architecture, not promotional scoring.",
    "Patient clarity and professional rigor on separate, intentional surfaces.",
    "Continuous deployment of clinical intelligence modules with public accountability.",
  ] as const,
};

/** Intelligence Engine modules — update completionPercent and status as work ships. */
export const INTELLIGENCE_MODULES: readonly IntelligenceModule[] = [
  {
    id: "hair-loss-classification",
    name: "Hair Loss Classification AI",
    completionPercent: 92,
    stage: "Production calibration",
    description:
      "Norwood/Ludwig pattern classification with confidence-aware photo quality gates and multi-view consensus.",
    status: "Production",
  },
  {
    id: "donor-intelligence",
    name: "Donor Intelligence Engine",
    completionPercent: 88,
    stage: "Live audit integration",
    description:
      "Donor density mapping, extraction pattern review, and overharvest risk signals from standardized photo sets.",
    status: "Live",
  },
  {
    id: "recipient-intelligence",
    name: "Recipient Intelligence Engine",
    completionPercent: 84,
    stage: "Pilot validation",
    description:
      "Recipient zone density distribution, placement pattern analysis, and hairline design realism scoring.",
    status: "Pilot Ready",
  },
  {
    id: "repair-procedure",
    name: "Repair Procedure Intelligence",
    completionPercent: 71,
    stage: "Model refinement",
    description:
      "Repair-case detection, prior-work artifact handling, and structured guidance for corrective procedure documentation.",
    status: "Active Development",
  },
  {
    id: "graft-requirement",
    name: "Graft Requirement Engine",
    completionPercent: 79,
    stage: "Benchmark alignment",
    description:
      "Evidence-based graft range estimation with donor reserve constraints and realistic density targets by zone.",
    status: "Active Development",
  },
  {
    id: "outcome-prediction",
    name: "Outcome Prediction Engine",
    completionPercent: 58,
    stage: "Dataset expansion",
    description:
      "Longitudinal outcome modeling from structured case timelines, technique metadata, and photo progression.",
    status: "Active Development",
  },
  {
    id: "procedural-risk",
    name: "Procedural Risk Intelligence",
    completionPercent: 65,
    stage: "Signal hardening",
    description:
      "Risk stratification for donor overharvest, unnatural design, and technique inconsistency from audit evidence.",
    status: "Active Development",
  },
  {
    id: "patient-recommendation",
    name: "Patient Recommendation Engine",
    completionPercent: 76,
    stage: "Plain-language layer",
    description:
      "Patient-safe next-step guidance, monitoring intervals, and discussion prompts derived from audit findings.",
    status: "Pilot Ready",
  },
];

/** Patient experience improvements — edit completionPercent as UX work lands. */
export const PATIENT_UX_FEATURES: readonly PatientUxFeature[] = [
  {
    id: "photo-intake",
    name: "Guided photo intake",
    completionPercent: 94,
    description: "Step-by-step capture guidance with quality feedback before submission.",
    focus: "Reduce incomplete submissions and retake cycles.",
  },
  {
    id: "report-readability",
    name: "Report readability",
    completionPercent: 86,
    description: "Plain-language summaries, confidence callouts, and scannable finding sections.",
    focus: "Translate clinical signals into patient-usable clarity.",
  },
  {
    id: "timeline-upload",
    name: "Post-op timeline upload",
    completionPercent: 81,
    description: "Multi-stage timeline capture with month markers and optional clinic document attachment.",
    focus: "Support growth-phase interpretation over time.",
  },
  {
    id: "mobile-dashboard",
    name: "Mobile patient dashboard",
    completionPercent: 72,
    description: "Responsive case status, report access, and secure re-upload from mobile devices.",
    focus: "Meet patients where they review results.",
  },
  {
    id: "accessibility",
    name: "Accessibility & localization",
    completionPercent: 68,
    description: "WCAG-oriented contrast, keyboard flows, and expanded locale coverage for public surfaces.",
    focus: "Global reach with medically credible presentation.",
  },
];

/** Public engineering changelog — newest first. */
export const ENGINEERING_CHANGELOG: readonly EngineeringChangelogEntry[] = [
  {
    date: "2026-06-18",
    title: "Donor Intelligence Engine — live in production audits",
    description:
      "Donor density analytics and extraction pattern review now run on all eligible patient audit intakes with reviewer override hooks.",
    area: "Intelligence",
  },
  {
    date: "2026-06-10",
    title: "Guided photo intake v2",
    description:
      "Real-time quality hints, angle diagrams, and incomplete-set warnings shipped to the patient upload flow.",
    area: "Patient Experience",
  },
  {
    date: "2026-06-02",
    title: "Hair Loss Classification — production calibration complete",
    description:
      "Multi-view classification consensus and photo-quality gates promoted from pilot to production scoring pipeline.",
    area: "Intelligence",
  },
  {
    date: "2026-05-22",
    title: "Platform progress page published",
    description:
      "Public engineering progress surface for intelligence modules, patient UX workstreams, and shipped changelog entries.",
    area: "Platform",
  },
  {
    date: "2026-05-14",
    title: "Audit report plain-language layer",
    description:
      "Structured finding summaries and discussion prompts added to patient-facing report exports.",
    area: "Patient Experience",
  },
  {
    date: "2026-05-01",
    title: "Intelligence infrastructure baseline",
    description:
      "Core module orchestration, evidence schema, and reviewer workflow infrastructure marked complete for v1 audit pipeline.",
    area: "Infrastructure",
  },
];
