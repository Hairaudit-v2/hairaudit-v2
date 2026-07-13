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

/** Overall patient experience engine readiness (rollup). */
export const PATIENT_EXPERIENCE_ENGINE = {
  name: "Patient Upload Experience",
  completionPercent: 98,
  description:
    "End-to-end patient surfaces — pathway routing, intake, uploads, processing UX, and report delivery — measured against production readiness.",
} as const;

/** HA-REPORT-4A/4B / independent review headline rollups — edit completionPercent as milestones land. */
export const PLATFORM_CAPABILITY_ROLLUPS: readonly PatientUxFeature[] = [
  {
    id: "pre-surgery-review-infrastructure",
    name: "Pre-Surgery Review Infrastructure",
    completionPercent: 99,
    description:
      "Dedicated pre-surgery planning report with pathway-specific planning outcomes, suitability scorecards, graft range estimates, donor review, preservation guidance, and premium PDF generation.",
    focus: "Pathway A — planning before surgery.",
  },
  {
    id: "patient-report-experience",
    name: "Patient Report Experience",
    completionPercent: 98,
    description:
      "Premium report opening, pathway-specific scorecards, review sections, image assessments, trust messaging, and recommended next steps across pre- and post-surgery reports.",
    focus: "Patient-facing report clarity and actionability.",
  },
  {
    id: "dual-pathway-report-architecture",
    name: "Dual Pathway Report Architecture",
    completionPercent: 100,
    description:
      "Separate pre-surgery planning and post-surgery audit report pipelines — dedicated generators, UI shells, PDF templates, and summary storage per pathway.",
    focus: "Pre-surgery planning intelligence vs post-surgery procedural review.",
  },
  {
    id: "independent-patient-intelligence",
    name: "Independent Patient Intelligence",
    completionPercent: 98,
    description:
      "Pathway-scoped intelligence execution, patient-safe narrative generation, donor and suitability signals, and mapping into dedicated report output without clinic bias.",
    focus: "Independent credibility and clinical neutrality.",
  },
];

/** HA-DUAL-PATHWAY-1 pathway infrastructure — edit completionPercent as each path matures. */
export const PATIENT_PATHWAY_INFRASTRUCTURE: readonly PatientUxFeature[] = [
  {
    id: "patient-pathway-architecture",
    name: "Patient Pathway Architecture",
    completionPercent: 100,
    description:
      "Homepage dual-pathway entry, case creation routing, and pathway persistence across the patient funnel.",
    focus: "Pre-Surgery Review and Post-Surgery Audit split at intake.",
  },
  {
    id: "post-surgery-audit-infrastructure",
    name: "Post-Surgery Audit Infrastructure",
    completionPercent: 99,
    description:
      "Dedicated post-surgery premium procedural review report with separate rendering, procedural integrity scoring, concern detection, image intelligence, trust architecture, repair guidance, and premium PDF generation.",
    focus: "Pathway B — independent post-surgical procedural review.",
  },
  {
    id: "pre-surgery-review-infrastructure",
    name: "Pre-Surgery Review Infrastructure",
    completionPercent: 99,
    description:
      "Dedicated pre-surgery planning report with pathway-specific planning outcomes, suitability scorecards, graft range estimates, donor review, preservation guidance, and premium PDF generation.",
    focus: "Pathway A — planning before surgery.",
  },
];

/** HA-QA-E2E-2 browser QA rollups — edit completionPercent as coverage expands. */
export const PATIENT_QA_ROLLUPS: readonly PatientUxFeature[] = [
  {
    id: "dual-pathway-qa-coverage",
    name: "Dual Pathway QA Coverage",
    completionPercent: 95,
    description:
      "Playwright E2E coverage across pre-surgery and post-surgery report shells, pathway chooser, evidence upload packs, and cross-pathway leakage guards on 20 seeded demo cases.",
    focus: "HA-QA-E2E-2 — browser walkthrough QA.",
  },
  {
    id: "patient-journey-reliability",
    name: "Patient Journey Reliability",
    completionPercent: 97,
    description:
      "End-to-end patient funnel verification — login, case access, anonymous→email account claim, processing timeline polling, ready-state handoff, and mobile layout smoke tests.",
    focus: "Full journey reliability, not unit tests alone. HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A hardening.",
  },
  {
    id: "report-delivery-qa",
    name: "Report Delivery QA",
    completionPercent: 96,
    description:
      "PDF download smoke tests, print-route template headers, pathway-specific report rendering, and delivery-phase gating before report shells surface.",
    focus: "Report delivery and template integrity.",
  },
  {
    id: "production-readiness",
    name: "Production Readiness",
    completionPercent: 92,
    description:
      "Production guardrails, graceful skip when seed data is unavailable, demo QA seed idempotency, and staging-safe E2E configuration.",
    focus: "Safe CI and local QA without production risk.",
  },
];

/** Overall patient QA readiness (rollup). */
export const PATIENT_QA_ENGINE = {
  name: "Patient Journey QA",
  completionPercent: 95,
  description:
    "Browser-level quality assurance for the dual-pathway patient experience — measured against E2E coverage, journey reliability, report delivery, and production readiness.",
} as const;

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
    date: "2026-07-14",
    title: "HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A — anonymous account claim fix",
    description:
      "Production account-claim failures at contact step are mapped correctly when an email is already registered (Postgres users_email_partial_key). Auth profile sync now supports anonymous null-email → populated email on the same uid, with correlation-id logging and patient-safe errors.",
    area: "Patient Experience",
  },
  {
    date: "2026-06-22",
    title: "HA-QA-E2E-2 deployed",
    description:
      "HairAudit now includes browser-level QA for the full dual-pathway patient journey, covering pre-surgery and post-surgery reports, pathway selection, evidence upload packs, waiting timeline, PDF routes, and mobile layouts.",
    area: "Infrastructure",
  },
  {
    date: "2026-06-21",
    title: "HA-REPORT-4A deployed",
    description:
      "HairAudit now generates a dedicated Pre-Surgery Planning Report for patients considering treatment, with pathway-specific planning outcomes, suitability scorecards, graft range estimates, donor review, preservation guidance, and a premium PDF template.",
    area: "Patient Experience",
  },
  {
    date: "2026-06-21",
    title: "HA-REPORT-4B deployed",
    description:
      "HairAudit now generates a dedicated post-surgery premium procedural review report with separate rendering architecture, procedural integrity scoring, concern detection, image intelligence, trust architecture, repair guidance, and premium PDF generation.",
    area: "Patient Experience",
  },
  {
    date: "2026-06-21",
    title: "HA-DUAL-PATHWAY-1 deployed",
    description:
      "HairAudit now supports two patient pathways end-to-end: Pre-Surgery Review and Post-Surgery Audit. Each pathway has dedicated upload requirements, intake logic, intelligence execution, and report focus areas.",
    area: "Patient Experience",
  },
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
