export type DoctorReportVisibility =
  | "INTERNAL"
  | "PUBLIC_PENDING_REVIEW"
  | "PUBLIC_APPROVED"
  | "PUBLIC_LIVE";

export type DoctorCaseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "NEEDS_INPUT"
  | "COMPLETED";

export type TrainingDomain =
  | "donor_management"
  | "implantation_precision"
  | "graft_handling"
  | "repair_planning"
  | "afro_hair_surgery"
  | "biologics";

export type DoctorDefaultSurgicalProfile = {
  extraction: {
    extractionMethod: string;
    punchType: string;
    punchDiameter: string;
    powerMode: "manual" | "motorised";
    donorShavingStyle: string;
    extractionPattern: string;
    donorManagementStyle: string;
  };
  graftHolding: {
    holdingSolution: string;
    chilled: boolean;
    handlingWorkflow: string;
    sortingProtocol: string;
    storageWorkflow: string;
  };
  implantation: {
    implantationTechnique: string;
    implanterType: string;
    bladeOrSlitType: string;
    placementModel: "doctor_only" | "technician_assisted";
    recipientSiteStyle: string;
    angleControlStyle: string;
  };
  adjuncts: {
    prpUsed: boolean;
    exosomesUsed: boolean;
    atpUsed: boolean;
    hypoThermosolUsed: boolean;
    fluidBase: string;
    donorRegenTechniques: string[];
    partialTransection: boolean;
  };
  workflow: {
    assistantCount: string;
    extractionOperator: string;
    implanterLoader: string;
    graftPlacementOperator: string;
    workflowModel: string;
  };
  postOp: {
    prpAftercareIncluded: boolean;
    medicationPlan: string;
    followUpCadence: string;
    reviewSchedule: string;
  };
};

export type DoctorCaseOverride = Partial<DoctorDefaultSurgicalProfile>;

export type DoctorProfileDemo = {
  id: string;
  userId: string;
  displayName: string;
  clinicName: string;
  country: string;
  city: string;
  profileCompletion: number;
};

export type DoctorCaseDemo = {
  id: string;
  patientReference: string;
  title: string;
  caseType: string;
  surgeryDate: string;
  status: DoctorCaseStatus;
  score: number | null;
  visibility: DoctorReportVisibility;
  needsInput: boolean;
  internalNotesPending: boolean;
  createdAt: string;
  weakDomains: TrainingDomain[];
  strengthDomains: TrainingDomain[];
  domainScores: Partial<Record<TrainingDomain, number>>;
  copiedFromCaseId?: string;
};

export type TrainingModule = {
  id: string;
  title: string;
  domain: TrainingDomain;
  level: "foundation" | "advanced" | "masterclass";
  locked: boolean;
  premium: boolean;
  estMinutes: number;
};

export const VISIBILITY_OPTIONS: Array<{
  value: DoctorReportVisibility;
  label: string;
  hint: string;
}> = [
  {
    value: "INTERNAL",
    label: "Internal only",
    hint: "Private quality-improvement report for your team only.",
  },
  {
    value: "PUBLIC_PENDING_REVIEW",
    label: "Internal now, public later",
    hint: "Queued for public suitability checks after completion.",
  },
  {
    value: "PUBLIC_APPROVED",
    label: "Public approved",
    hint: "Approved for publication, can go live when you choose.",
  },
  {
    value: "PUBLIC_LIVE",
    label: "Public live",
    hint: "Visible publicly for discoverability and trust signals.",
  },
];

export const defaultSurgicalProfileDemo: DoctorDefaultSurgicalProfile = {
  extraction: {
    extractionMethod: "FUE",
    punchType: "Hybrid trumpet",
    punchDiameter: "0.85 mm",
    powerMode: "motorised",
    donorShavingStyle: "Partial shave",
    extractionPattern: "Diffuse safe-zone spread",
    donorManagementStyle: "Density-preserving micro zoning",
  },
  graftHolding: {
    holdingSolution: "HypoThermosol + saline blend",
    chilled: true,
    handlingWorkflow: "Two-tech hydration relay",
    sortingProtocol: "1/2/3/4-hair grouped trays",
    storageWorkflow: "Time-batched chilled cassettes",
  },
  implantation: {
    implantationTechnique: "DHI-assisted FUE",
    implanterType: "Lion implanter 0.8/0.9",
    bladeOrSlitType: "Sapphire slit support",
    placementModel: "technician_assisted",
    recipientSiteStyle: "Doctor pre-sites + assisted placement",
    angleControlStyle: "Zonal angle template with close supervision",
  },
  adjuncts: {
    prpUsed: true,
    exosomesUsed: false,
    atpUsed: true,
    hypoThermosolUsed: true,
    fluidBase: "Saline + LR",
    donorRegenTechniques: ["Low-level laser", "Microneedled PRP"],
    partialTransection: false,
  },
  workflow: {
    assistantCount: "4-6",
    extractionOperator: "Lead tech under doctor supervision",
    implanterLoader: "Senior technician",
    graftPlacementOperator: "Mixed doctor + team",
    workflowModel: "Parallel extraction + placement lanes",
  },
  postOp: {
    prpAftercareIncluded: true,
    medicationPlan: "Standard anti-inflammatory + antibiotic cover",
    followUpCadence: "Day 1, Day 7, Month 1, Month 6, Month 12",
    reviewSchedule: "Quarterly photo benchmarking",
  },
};

export const doctorProfileDemo: DoctorProfileDemo = {
  id: "dp_001",
  userId: "user_doctor_01",
  displayName: "Dr. E. Kaya",
  clinicName: "North Bosphorus Hair Center",
  country: "Turkey",
  city: "Istanbul",
  profileCompletion: 82,
};

export const previousCaseOverrideTemplates: Record<string, DoctorCaseOverride> = {
  dc_001: {
    extraction: { punchDiameter: "0.80 mm", extractionPattern: "Hairline-priority staggered zones" },
    implantation: { implanterType: "Lion implanter 0.8", placementModel: "technician_assisted" },
  },
  dc_002: {
    extraction: { donorManagementStyle: "Conservative donor preservation", donorShavingStyle: "Full shave" },
    adjuncts: { prpUsed: false, exosomesUsed: false },
    workflow: { assistantCount: "3-4" },
  },
  dc_003: {
    extraction: { punchType: "Sharp", punchDiameter: "0.90 mm" },
    implantation: { angleControlStyle: "Afro curl-aware micro-zonal control" },
    adjuncts: { atpUsed: false, donorRegenTechniques: ["Low-level laser"] },
  },
  dc_004: {
    graftHolding: { chilled: false, holdingSolution: "LR" },
    workflow: { workflowModel: "Sequential workflow", assistantCount: "3-4" },
  },
};

export const doctorCasesDemo: DoctorCaseDemo[] = [
  {
    id: "dc_001",
    patientReference: "HA-DR-2041",
    title: "Hairline restoration + frontal third",
    caseType: "Hairline / diffuse",
    surgeryDate: "2026-02-10",
    status: "COMPLETED",
    score: 84,
    visibility: "PUBLIC_LIVE",
    needsInput: false,
    internalNotesPending: false,
    createdAt: "2026-02-10T10:22:00Z",
    weakDomains: ["graft_handling"],
    strengthDomains: ["implantation_precision", "donor_management"],
    domainScores: {
      donor_management: 88,
      implantation_precision: 91,
      graft_handling: 72,
      repair_planning: 79,
    },
  },
  {
    id: "dc_002",
    patientReference: "HA-DR-2056",
    title: "Repair case with donor conservation",
    caseType: "Repair / crown",
    surgeryDate: "2026-02-24",
    status: "IN_REVIEW",
    score: null,
    visibility: "PUBLIC_PENDING_REVIEW",
    needsInput: true,
    internalNotesPending: true,
    createdAt: "2026-02-24T09:14:00Z",
    weakDomains: ["donor_management", "repair_planning"],
    strengthDomains: ["graft_handling"],
    domainScores: {
      donor_management: 66,
      implantation_precision: 78,
      graft_handling: 81,
      repair_planning: 64,
    },
  },
  {
    id: "dc_003",
    patientReference: "HA-DR-2092",
    title: "Afro FUE density pack",
    caseType: "Afro / hairline",
    surgeryDate: "2026-03-01",
    status: "NEEDS_INPUT",
    score: 72,
    visibility: "INTERNAL",
    needsInput: true,
    internalNotesPending: true,
    createdAt: "2026-03-01T08:01:00Z",
    weakDomains: ["afro_hair_surgery", "implantation_precision"],
    strengthDomains: ["donor_management"],
    domainScores: {
      donor_management: 82,
      implantation_precision: 68,
      afro_hair_surgery: 63,
      graft_handling: 75,
    },
  },
  {
    id: "dc_004",
    patientReference: "HA-DR-2115",
    title: "Crown + mid-scalp session",
    caseType: "Crown",
    surgeryDate: "2026-03-07",
    status: "SUBMITTED",
    score: null,
    visibility: "INTERNAL",
    needsInput: false,
    internalNotesPending: false,
    createdAt: "2026-03-07T12:40:00Z",
    weakDomains: [],
    strengthDomains: ["graft_handling", "implantation_precision"],
    domainScores: {
      donor_management: 83,
      implantation_precision: 86,
      graft_handling: 84,
      repair_planning: 80,
    },
  },
];

export const scoreTrendDemo = [69, 71, 72, 75, 77, 79, 78, 81, 84];
export const casesOverTimeDemo = [1, 2, 1, 3, 2, 2, 4, 3, 5, 4, 3, 6];
export const outcomesByStatusDemo = [
  { status: "Completed", value: 18 },
  { status: "In Review", value: 5 },
  { status: "Needs Input", value: 3 },
  { status: "Draft", value: 2 },
];
export const strengthDistributionDemo = [
  { domain: "Donor management", value: 78 },
  { domain: "Implantation precision", value: 82 },
  { domain: "Graft handling", value: 71 },
  { domain: "Documentation quality", value: 86 },
  { domain: "Repair planning", value: 74 },
];
export const publicVsInternalDemo = [
  { label: "Public", value: 14 },
  { label: "Internal", value: 23 },
];

export const auditCompletionPipelineDemo = [
  { stage: "Draft", value: 22, color: "slate" },
  { stage: "Submitted", value: 19, color: "cyan" },
  { stage: "In Review", value: 14, color: "amber" },
  { stage: "Completed", value: 11, color: "emerald" },
  { stage: "Public Live", value: 7, color: "violet" },
];

export const trainingModulesDemo: TrainingModule[] = [
  {
    id: "tm_001",
    title: "Donor zone preservation in high-yield days",
    domain: "donor_management",
    level: "advanced",
    locked: false,
    premium: false,
    estMinutes: 24,
  },
  {
    id: "tm_002",
    title: "Implanter loading precision under speed pressure",
    domain: "implantation_precision",
    level: "masterclass",
    locked: true,
    premium: true,
    estMinutes: 36,
  },
  {
    id: "tm_003",
    title: "Graft hydration and exposure-time control",
    domain: "graft_handling",
    level: "foundation",
    locked: false,
    premium: false,
    estMinutes: 18,
  },
  {
    id: "tm_004",
    title: "Repair planning for depleted donor profiles",
    domain: "repair_planning",
    level: "advanced",
    locked: true,
    premium: true,
    estMinutes: 42,
  },
  {
    id: "tm_005",
    title: "Afro hair extraction and angulation safeguards",
    domain: "afro_hair_surgery",
    level: "masterclass",
    locked: false,
    premium: true,
    estMinutes: 33,
  },
  {
    id: "tm_006",
    title: "Biologics in modern hair restoration",
    domain: "biologics",
    level: "foundation",
    locked: false,
    premium: false,
    estMinutes: 15,
  },
];

export function mergeCaseSettings(
  defaults: DoctorDefaultSurgicalProfile,
  overrides: DoctorCaseOverride | null
): DoctorDefaultSurgicalProfile {
  if (!overrides) return defaults;
  return {
    extraction: { ...defaults.extraction, ...(overrides.extraction ?? {}) },
    graftHolding: { ...defaults.graftHolding, ...(overrides.graftHolding ?? {}) },
    implantation: { ...defaults.implantation, ...(overrides.implantation ?? {}) },
    adjuncts: { ...defaults.adjuncts, ...(overrides.adjuncts ?? {}) },
    workflow: { ...defaults.workflow, ...(overrides.workflow ?? {}) },
    postOp: { ...defaults.postOp, ...(overrides.postOp ?? {}) },
  };
}

export function resolveCaseSettingsFromLayers(input: {
  doctorProfile: DoctorProfileDemo;
  defaults: DoctorDefaultSurgicalProfile;
  overrideMode: "saved" | "previous" | "custom";
  customOverrides: DoctorCaseOverride | null;
  previousCaseId?: string;
}) {
  const previousOverrides =
    input.overrideMode === "previous" && input.previousCaseId
      ? previousCaseOverrideTemplates[input.previousCaseId] ?? null
      : null;
  const selectedOverrides =
    input.overrideMode === "custom"
      ? input.customOverrides
      : input.overrideMode === "previous"
        ? previousOverrides
        : null;

  return {
    doctorProfileId: input.doctorProfile.id,
    defaultsVersionUsed: 1,
    selectedOverrides,
    resolvedSettings: mergeCaseSettings(input.defaults, selectedOverrides),
  };
}

export function createSubmissionSnapshot(input: {
  doctorProfile: DoctorProfileDemo;
  defaults: DoctorDefaultSurgicalProfile;
  overrideMode: "saved" | "previous" | "custom";
  customOverrides: DoctorCaseOverride | null;
  previousCaseId?: string;
}) {
  const resolved = resolveCaseSettingsFromLayers(input);
  return {
    submittedAt: new Date().toISOString(),
    locked: true,
    doctorProfileId: resolved.doctorProfileId,
    defaultsVersionUsed: resolved.defaultsVersionUsed,
    overridesSnapshot: resolved.selectedOverrides ?? {},
    resolvedSettingsSnapshot: resolved.resolvedSettings,
  };
}

export function getDefaultProfileCompletion(profile: DoctorDefaultSurgicalProfile): number {
  const values: Array<unknown> = [
    profile.extraction.extractionMethod,
    profile.extraction.punchType,
    profile.extraction.punchDiameter,
    profile.extraction.powerMode,
    profile.extraction.donorShavingStyle,
    profile.extraction.extractionPattern,
    profile.extraction.donorManagementStyle,
    profile.graftHolding.holdingSolution,
    profile.graftHolding.handlingWorkflow,
    profile.graftHolding.sortingProtocol,
    profile.graftHolding.storageWorkflow,
    profile.implantation.implantationTechnique,
    profile.implantation.implanterType,
    profile.implantation.bladeOrSlitType,
    profile.implantation.placementModel,
    profile.implantation.recipientSiteStyle,
    profile.implantation.angleControlStyle,
    profile.adjuncts.fluidBase,
    profile.workflow.assistantCount,
    profile.workflow.extractionOperator,
    profile.workflow.implanterLoader,
    profile.workflow.graftPlacementOperator,
    profile.workflow.workflowModel,
    profile.postOp.medicationPlan,
    profile.postOp.followUpCadence,
    profile.postOp.reviewSchedule,
  ];
  const total = values.length;
  const complete = values.filter((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  }).length;
  return Math.round((complete / total) * 100);
}

export function getRecommendedModulesFromCases(cases: DoctorCaseDemo[]): TrainingDomain[] {
  const counts = new Map<TrainingDomain, number>();
  for (const c of cases) {
    for (const d of c.weakDomains) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);
}
