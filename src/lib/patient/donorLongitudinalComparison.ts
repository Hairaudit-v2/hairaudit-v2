/**
 * HA-DONOR-HEALING-1C — Longitudinal donor photograph comparison.
 *
 * View pairing only (rear/left/right). Describes visible change across
 * comparable photographs. Never claims follicle death, permanent depletion,
 * exact density loss, confirmed overharvesting, or future safe graft capacity.
 */

import {
  DONOR_HEALING_ENTRY_CONTEXT,
  containsForbiddenDonorDiagnosticLanguage,
  type DonorHealingEntryContext,
} from "@/lib/patient/donorHealingEntry";
import { sanitizePatientReportText } from "@/lib/reports/postSurgeryPatientText";
import { caseHasDonorHealingEntryContext } from "@/lib/patient/donorHealingOrientationReport";

export const DONOR_LONGITUDINAL_COMPARISON_VERSION = 1 as const;

export const DONOR_LONGITUDINAL_COMPARISON_STATES = [
  "improving_appearance",
  "broadly_stable",
  "persistent_irregularity",
  "increased_visible_patchiness",
  "not_comparable",
  "insufficient_longitudinal_evidence",
] as const;

export type DonorLongitudinalComparisonState =
  (typeof DONOR_LONGITUDINAL_COMPARISON_STATES)[number];

export const DONOR_LONGITUDINAL_COMPARISON_LABELS: Record<
  DonorLongitudinalComparisonState,
  string
> = {
  improving_appearance:
    "Visible appearance looks improved across comparable photos",
  broadly_stable:
    "Visible appearance looks broadly stable across comparable photos",
  persistent_irregularity:
    "Persistent irregularity remains visible across comparable photos",
  increased_visible_patchiness:
    "Patchiness looks more noticeable across comparable photos",
  not_comparable:
    "The photographs are not comparable enough for a reliable longitudinal read",
  insufficient_longitudinal_evidence:
    "There is not enough dated donor evidence for longitudinal comparison",
};

export const DONOR_COMPARISON_VIEWS = ["rear", "left", "right"] as const;
export type DonorComparisonView = (typeof DONOR_COMPARISON_VIEWS)[number];

export const DONOR_COMPARABILITY_LIMITATIONS = [
  "lighting",
  "hair_length",
  "angle",
  "distance",
] as const;
export type DonorComparabilityLimitation =
  (typeof DONOR_COMPARABILITY_LIMITATIONS)[number];

export type DonorComparisonProvenanceSource =
  | "automated_preparation"
  | "clinician_confirmation"
  | "clinician_correction";

export type DonorComparisonUploadInput = {
  id: string;
  type: string;
  capturedAt?: string | null;
  signedUrl?: string | null;
};

export type DonorPhotoSetViewRef = {
  uploadId: string;
  categoryKey: string;
  capturedAt: string | null;
  /** Present when resolved at render; not required in stored record. */
  signedUrl?: string | null;
};

export type DonorPhotoSet = {
  id: string;
  label: string;
  /** Ordinal for chronological sort (lower = earlier). */
  sortKey: number;
  dateSource: "category_band" | "captured_at" | "mixed";
  categoryBand: string;
  capturedAt: string | null;
  views: Partial<Record<DonorComparisonView, DonorPhotoSetViewRef>>;
};

export type DonorViewPair = {
  view: DonorComparisonView;
  baselineSetId: string;
  compareSetId: string;
  baseline: DonorPhotoSetViewRef;
  compare: DonorPhotoSetViewRef;
};

export type DonorComparability = {
  sufficient: boolean;
  scoreBand: "comparable" | "limited" | "not_comparable" | "insufficient";
  limitations: DonorComparabilityLimitation[];
  reasons: string[];
};

export type DonorComparisonProvenanceEvent = {
  at: string;
  source: DonorComparisonProvenanceSource;
  state: DonorLongitudinalComparisonState;
  actorUserId?: string | null;
  previousState?: DonorLongitudinalComparisonState | null;
};

export type DonorComparisonProvenance = {
  source: DonorComparisonProvenanceSource;
  preparedAt: string;
  preparedBySystem: boolean;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  correctedFrom?: DonorLongitudinalComparisonState | null;
  history: DonorComparisonProvenanceEvent[];
};

/** Immutable frozen copy appended on confirm/correct. */
export type DonorComparisonSnapshot = {
  id: string;
  at: string;
  actorUserId: string | null;
  source: DonorComparisonProvenanceSource;
  overallState: DonorLongitudinalComparisonState;
  /** Stable digest of clinical fields at freeze time. */
  payloadDigest: string;
  /** Frozen clinical payload (no mutation of prior snapshots). */
  payload: {
    overallState: DonorLongitudinalComparisonState;
    viewStates: Partial<Record<DonorComparisonView, DonorLongitudinalComparisonState>>;
    comparability: DonorComparability;
    narrative: string;
    setIds: string[];
    pairCount: number;
  };
};

/**
 * Full record stored on `reports.summary.donor_longitudinal_comparison`.
 */
export type DonorLongitudinalComparisonRecord = {
  version: typeof DONOR_LONGITUDINAL_COMPARISON_VERSION;
  entryContext: DonorHealingEntryContext;
  overallState: DonorLongitudinalComparisonState;
  patientLabel: string;
  narrative: string;
  viewStates: Partial<Record<DonorComparisonView, DonorLongitudinalComparisonState>>;
  sets: DonorPhotoSet[];
  pairs: DonorViewPair[];
  comparability: DonorComparability;
  provenance: DonorComparisonProvenance;
  snapshots: DonorComparisonSnapshot[];
};

/** Patient / PDF-safe slice — no actor ids; only when clinician-reviewed. */
export type PatientSafeDonorLongitudinalSlice = {
  overallState: DonorLongitudinalComparisonState;
  label: string;
  narrative: string;
  caveat: string;
  viewStates: Partial<
    Record<DonorComparisonView, { state: DonorLongitudinalComparisonState; label: string }>
  >;
  limitations: DonorComparabilityLimitation[];
  pairs: Array<{
    view: DonorComparisonView;
    viewLabel: string;
    baseline: { label: string; signedUrl: string | null };
    compare: { label: string; signedUrl: string | null };
  }>;
  provenanceLabel: string;
  provenanceSource: DonorComparisonProvenanceSource;
};

export type BuildDonorLongitudinalInput = {
  answers?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  uploads?: readonly DonorComparisonUploadInput[] | null;
  uploadTypes?: readonly string[] | null;
  photosByCategory?: Record<string, unknown> | null;
  /** Clinician-supplied limitations when preparing/correcting. */
  limitations?: readonly DonorComparabilityLimitation[] | null;
  now?: Date;
};

export const DONOR_LONGITUDINAL_IMAGE_CAVEAT =
  "Visual comparisons can be influenced by lighting, angle, hair length, and distance. HairAudit describes visible change across comparable photographs and does not measure graft survival, density loss, or future donor capacity.";

const VIEW_LABELS: Record<DonorComparisonView, string> = {
  rear: "Rear donor",
  left: "Left donor",
  right: "Right donor",
};

/** Category band → chronological sort key. */
const BAND_SORT: Record<string, number> = {
  preop: 10,
  day0: 20,
  day1: 30,
  week1: 40,
  month3: 50,
  month6: 60,
  month9: 70,
  month12: 80,
  followup: 90,
  current: 95,
  unknown: 100,
};

const BAND_LABELS: Record<string, string> = {
  preop: "Pre-procedure / early baseline",
  day0: "Day of procedure",
  day1: "Day 1",
  week1: "Week 1",
  month3: "Around 3 months",
  month6: "Around 6 months",
  month9: "Around 9 months",
  month12: "Around 12 months",
  followup: "Follow-up",
  current: "Current views",
  unknown: "Undated donor set",
};

const STATE_NARRATIVES: Record<DonorLongitudinalComparisonState, string> = {
  improving_appearance:
    "Across the comparable donor photographs, visible appearance looks improved relative to the earlier set. This describes photographic appearance only and is not a measurement of follicle survival or density.",
  broadly_stable:
    "Across the comparable donor photographs, visible appearance looks broadly stable. Lighting, hair length, and camera distance can still affect how evenness looks in photos.",
  persistent_irregularity:
    "Across the comparable donor photographs, irregularity remains visible. Structured clinical discussion with your treating clinic is appropriate; photographs alone do not confirm a diagnosis.",
  increased_visible_patchiness:
    "Across the comparable donor photographs, patchiness looks more noticeable in later views. This is a visible-change observation for discussion, not a confirmed density or capacity conclusion.",
  not_comparable:
    "The available donor photographs differ enough in lighting, hair length, angle, or distance that a reliable longitudinal comparison cannot be offered from these images alone.",
  insufficient_longitudinal_evidence:
    "There are not enough dated donor photographs with matching views to support a longitudinal comparison yet. Additional rear, left, and right views from more than one timepoint would help.",
};

export function isDonorLongitudinalComparisonState(
  value: unknown
): value is DonorLongitudinalComparisonState {
  return (
    typeof value === "string" &&
    (DONOR_LONGITUDINAL_COMPARISON_STATES as readonly string[]).includes(value)
  );
}

export function isDonorComparabilityLimitation(
  value: unknown
): value is DonorComparabilityLimitation {
  return (
    typeof value === "string" &&
    (DONOR_COMPARABILITY_LIMITATIONS as readonly string[]).includes(value)
  );
}

export function donorLongitudinalComparisonLabel(
  state: DonorLongitudinalComparisonState
): string {
  return DONOR_LONGITUDINAL_COMPARISON_LABELS[state];
}

export function stripPatientPhotoPrefix(type: string): string {
  const t = String(type ?? "").trim().toLowerCase();
  return t.startsWith("patient_photo:") ? t.slice("patient_photo:".length) : t;
}

export function classifyDonorComparisonView(
  categoryKey: string
): DonorComparisonView | null {
  const c = categoryKey.toLowerCase();
  if (c.includes("donor_left") || (c.includes("left") && c.includes("donor"))) {
    return "left";
  }
  if (c.includes("donor_right") || (c.includes("right") && c.includes("donor"))) {
    return "right";
  }
  if (
    c.includes("donor_rear") ||
    c.includes("donor_closeup") ||
    c.includes("postop_healed_donor") ||
    c.includes("followup_donor") ||
    /postop_(day1|week1|month\d+)_donor$/.test(c) ||
    c === "patient_current_donor_rear" ||
    (c.includes("donor") && !c.includes("left") && !c.includes("right"))
  ) {
    return "rear";
  }
  return null;
}

export function resolveDonorCategoryBand(categoryKey: string): string {
  const c = categoryKey.toLowerCase();
  if (c.includes("preop")) return "preop";
  if (c.includes("day0")) return "day0";
  if (c.includes("day1")) return "day1";
  if (c.includes("week1")) return "week1";
  if (c.includes("month3")) return "month3";
  if (c.includes("month6")) return "month6";
  if (c.includes("month9")) return "month9";
  if (c.includes("month12")) return "month12";
  if (c.includes("followup")) return "followup";
  if (c.includes("patient_current") || c.includes("current_donor")) return "current";
  return "unknown";
}

function capturedAtMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/**
 * Cluster donor uploads into dated photo sets by category band.
 */
export function clusterDonorPhotoSets(
  uploads: readonly DonorComparisonUploadInput[]
): DonorPhotoSet[] {
  type Acc = {
    band: string;
    views: Partial<Record<DonorComparisonView, DonorPhotoSetViewRef>>;
    capturedAts: string[];
  };
  const byBand = new Map<string, Acc>();

  for (const upload of uploads) {
    const categoryKey = stripPatientPhotoPrefix(upload.type);
    if (!categoryKey) continue;
    const view = classifyDonorComparisonView(categoryKey);
    if (!view) continue;

    const band = resolveDonorCategoryBand(categoryKey);
    let acc = byBand.get(band);
    if (!acc) {
      acc = { band, views: {}, capturedAts: [] };
      byBand.set(band, acc);
    }

    const capturedAt =
      typeof upload.capturedAt === "string" && upload.capturedAt.trim()
        ? upload.capturedAt.trim()
        : null;
    if (capturedAt) acc.capturedAts.push(capturedAt);

    if (!acc.views[view]) {
      acc.views[view] = {
        uploadId: upload.id,
        categoryKey,
        capturedAt,
        signedUrl: upload.signedUrl ?? null,
      };
    }
  }

  const sets: DonorPhotoSet[] = [];
  for (const acc of byBand.values()) {
    if (Object.keys(acc.views).length === 0) continue;
    const capturedAt =
      acc.capturedAts.sort()[0] ??
      Object.values(acc.views).find((v) => v?.capturedAt)?.capturedAt ??
      null;
    const hasCaptured = Boolean(capturedAt);
    const dateSource: DonorPhotoSet["dateSource"] =
      hasCaptured && acc.band !== "unknown"
        ? "mixed"
        : hasCaptured
          ? "captured_at"
          : "category_band";
    const sortKey =
      (BAND_SORT[acc.band] ?? 100) +
      (capturedAtMs(capturedAt) != null
        ? Math.min(9, Math.floor((capturedAtMs(capturedAt)! % 1_000_000) / 100_000))
        : 0);

    sets.push({
      id: `set_${acc.band}`,
      label: BAND_LABELS[acc.band] ?? acc.band,
      sortKey,
      dateSource,
      categoryBand: acc.band,
      capturedAt,
      views: acc.views,
    });
  }

  return sets.sort((a, b) => a.sortKey - b.sortKey || a.id.localeCompare(b.id));
}

/**
 * Pair matching views between the earliest baseline set and the latest later set.
 */
export function pairDonorViewsAcrossSets(sets: readonly DonorPhotoSet[]): DonorViewPair[] {
  if (sets.length < 2) return [];
  const baseline = sets[0]!;
  const compare = sets[sets.length - 1]!;
  if (baseline.id === compare.id) return [];

  const pairs: DonorViewPair[] = [];
  for (const view of DONOR_COMPARISON_VIEWS) {
    const b = baseline.views[view];
    const c = compare.views[view];
    if (!b || !c) continue;
    pairs.push({
      view,
      baselineSetId: baseline.id,
      compareSetId: compare.id,
      baseline: b,
      compare: c,
    });
  }
  return pairs;
}

export function evaluateDonorComparability(input: {
  sets: readonly DonorPhotoSet[];
  pairs: readonly DonorViewPair[];
  limitations?: readonly DonorComparabilityLimitation[] | null;
  answers?: Record<string, unknown> | null;
}): DonorComparability {
  const limitations = normalizeLimitations(input.limitations);
  const reasons: string[] = [];

  if (input.sets.length < 2) {
    reasons.push("Fewer than two dated donor photo sets");
  }
  if (input.pairs.length === 0) {
    reasons.push("No matching rear/left/right views across dated sets");
  }

  const hasComparisonPhotos = String(
    input.answers?.donor_has_comparison_photos ?? ""
  )
    .trim()
    .toLowerCase();
  if (hasComparisonPhotos === "no") {
    reasons.push("Patient reported no earlier comparison photographs");
  }

  if (limitations.length > 0) {
    reasons.push(
      `Recorded limitations: ${limitations.join(", ").replace(/_/g, " ")}`
    );
  }

  if (input.sets.length < 2 || input.pairs.length === 0) {
    return {
      sufficient: false,
      scoreBand: "insufficient",
      limitations,
      reasons,
    };
  }

  if (limitations.length >= 3) {
    return {
      sufficient: false,
      scoreBand: "not_comparable",
      limitations,
      reasons,
    };
  }

  if (limitations.length > 0) {
    return {
      sufficient: true,
      scoreBand: "limited",
      limitations,
      reasons,
    };
  }

  return {
    sufficient: true,
    scoreBand: "comparable",
    limitations,
    reasons,
  };
}

function normalizeLimitations(
  raw: readonly DonorComparabilityLimitation[] | null | undefined
): DonorComparabilityLimitation[] {
  if (!raw?.length) return [];
  const out: DonorComparabilityLimitation[] = [];
  for (const item of raw) {
    if (isDonorComparabilityLimitation(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

/**
 * Deterministic draft mapping — weak heuristics only; never density math.
 */
export function mapDonorLongitudinalComparisonState(input: {
  comparability: DonorComparability;
  appearanceTrend?: string | null;
}): DonorLongitudinalComparisonState {
  if (input.comparability.scoreBand === "insufficient") {
    return "insufficient_longitudinal_evidence";
  }
  if (input.comparability.scoreBand === "not_comparable") {
    return "not_comparable";
  }

  const trend = String(input.appearanceTrend ?? "").toLowerCase();
  if (trend === "improving") return "improving_appearance";
  if (trend === "worsening") return "increased_visible_patchiness";
  if (trend === "stable") return "broadly_stable";

  return "broadly_stable";
}

export function buildDonorLongitudinalNarrative(
  state: DonorLongitudinalComparisonState
): string {
  return sanitizePatientReportText(STATE_NARRATIVES[state]);
}

export function provenanceLabelForDonorComparison(
  source: DonorComparisonProvenanceSource
): string {
  switch (source) {
    case "clinician_confirmation":
      return "Confirmed by reviewing clinician";
    case "clinician_correction":
      return "Updated after clinician review";
    default:
      return "Prepared automatically for clinician review";
  }
}

export function assertPatientSafeDonorComparisonText(text: string): string {
  const cleaned = sanitizePatientReportText(text);
  if (containsForbiddenDonorDiagnosticLanguage(cleaned)) {
    return DONOR_LONGITUDINAL_COMPARISON_LABELS.insufficient_longitudinal_evidence;
  }
  return cleaned;
}

function simpleDigest(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `d${(h >>> 0).toString(16)}`;
}

export function buildComparisonSnapshot(args: {
  record: Pick<
    DonorLongitudinalComparisonRecord,
    "overallState" | "viewStates" | "comparability" | "narrative" | "sets" | "pairs"
  >;
  source: DonorComparisonProvenanceSource;
  actorUserId: string | null;
  at?: string;
}): DonorComparisonSnapshot {
  const at = args.at ?? new Date().toISOString();
  const payload = {
    overallState: args.record.overallState,
    viewStates: { ...args.record.viewStates },
    comparability: {
      ...args.record.comparability,
      limitations: [...args.record.comparability.limitations],
      reasons: [...args.record.comparability.reasons],
    },
    narrative: args.record.narrative,
    setIds: args.record.sets.map((s) => s.id),
    pairCount: args.record.pairs.length,
  };
  const payloadDigest = simpleDigest([
    payload.overallState,
    JSON.stringify(payload.viewStates),
    payload.comparability.scoreBand,
    payload.comparability.limitations.join(","),
    payload.setIds.join(","),
    String(payload.pairCount),
  ]);
  return {
    id: `snap_${at.replace(/[:.]/g, "")}_${payloadDigest}`,
    at,
    actorUserId: args.actorUserId,
    source: args.source,
    overallState: args.record.overallState,
    payloadDigest,
    payload,
  };
}

function collectUploads(input: BuildDonorLongitudinalInput): DonorComparisonUploadInput[] {
  if (input.uploads?.length) {
    return input.uploads.map((u) => ({
      id: String(u.id),
      type: String(u.type),
      capturedAt: u.capturedAt ?? null,
      signedUrl: u.signedUrl ?? null,
    }));
  }
  const synthetic: DonorComparisonUploadInput[] = [];
  for (const [i, raw] of (input.uploadTypes ?? []).entries()) {
    synthetic.push({ id: `type_${i}`, type: String(raw) });
  }
  if (input.photosByCategory) {
    for (const [key, value] of Object.entries(input.photosByCategory)) {
      const list = Array.isArray(value) ? value : [];
      for (const [j, item] of list.entries()) {
        const rec =
          item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        synthetic.push({
          id: String(rec.id ?? `cat_${key}_${j}`),
          type: key,
          capturedAt: typeof rec.capturedAt === "string" ? rec.capturedAt : null,
          signedUrl: typeof rec.signedUrl === "string" ? rec.signedUrl : null,
        });
      }
    }
  }
  return synthetic;
}

function defaultViewStates(
  pairs: readonly DonorViewPair[],
  overall: DonorLongitudinalComparisonState
): Partial<Record<DonorComparisonView, DonorLongitudinalComparisonState>> {
  const out: Partial<Record<DonorComparisonView, DonorLongitudinalComparisonState>> = {};
  for (const p of pairs) {
    out[p.view] = overall;
  }
  return out;
}

/** Build a fresh automated comparison record. */
export function buildAutomatedDonorLongitudinalComparison(
  input: BuildDonorLongitudinalInput
): DonorLongitudinalComparisonRecord | null {
  if (!caseHasDonorHealingEntryContext(input)) return null;

  const answers = input.answers ?? null;
  const uploads = collectUploads(input);
  const sets = clusterDonorPhotoSets(uploads);
  const pairs = pairDonorViewsAcrossSets(sets);
  const comparability = evaluateDonorComparability({
    sets,
    pairs,
    limitations: input.limitations,
    answers,
  });
  const appearanceTrend =
    (answers?.donor_appearance_trend as string | undefined) ??
    (answers?.appearance_trend as string | undefined) ??
    null;
  const overallState = mapDonorLongitudinalComparisonState({
    comparability,
    appearanceTrend,
  });
  const preparedAt = (input.now ?? new Date()).toISOString();
  const patientLabel = assertPatientSafeDonorComparisonText(
    donorLongitudinalComparisonLabel(overallState)
  );
  const narrative = assertPatientSafeDonorComparisonText(
    buildDonorLongitudinalNarrative(overallState)
  );
  const viewStates = defaultViewStates(pairs, overallState);

  return {
    version: DONOR_LONGITUDINAL_COMPARISON_VERSION,
    entryContext: DONOR_HEALING_ENTRY_CONTEXT,
    overallState,
    patientLabel,
    narrative,
    viewStates,
    sets,
    pairs,
    comparability,
    provenance: {
      source: "automated_preparation",
      preparedAt,
      preparedBySystem: true,
      confirmedAt: null,
      confirmedByUserId: null,
      correctedFrom: null,
      history: [
        {
          at: preparedAt,
          source: "automated_preparation",
          state: overallState,
          actorUserId: null,
          previousState: null,
        },
      ],
    },
    snapshots: [],
  };
}

export function isDonorLongitudinalComparisonRecord(
  value: unknown
): value is DonorLongitudinalComparisonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DONOR_LONGITUDINAL_COMPARISON_VERSION &&
    v.entryContext === DONOR_HEALING_ENTRY_CONTEXT &&
    isDonorLongitudinalComparisonState(v.overallState) &&
    typeof v.patientLabel === "string" &&
    typeof v.narrative === "string" &&
    Array.isArray(v.sets) &&
    Array.isArray(v.pairs) &&
    v.comparability != null &&
    typeof v.comparability === "object" &&
    v.provenance != null &&
    typeof v.provenance === "object" &&
    Array.isArray(v.snapshots)
  );
}

export function isClinicianReviewedDonorComparison(
  record: DonorLongitudinalComparisonRecord
): boolean {
  return (
    record.provenance.source === "clinician_confirmation" ||
    record.provenance.source === "clinician_correction"
  );
}

/**
 * Clinician confirmation — freezes current state and appends an immutable snapshot.
 */
export function confirmDonorLongitudinalComparison(
  existing: DonorLongitudinalComparisonRecord,
  opts: { actorUserId: string; at?: string }
): DonorLongitudinalComparisonRecord {
  const at = opts.at ?? new Date().toISOString();
  const snapshot = buildComparisonSnapshot({
    record: existing,
    source: "clinician_confirmation",
    actorUserId: opts.actorUserId,
    at,
  });
  return {
    ...existing,
    provenance: {
      ...existing.provenance,
      source: "clinician_confirmation",
      confirmedAt: at,
      confirmedByUserId: opts.actorUserId,
      history: [
        ...existing.provenance.history,
        {
          at,
          source: "clinician_confirmation",
          state: existing.overallState,
          actorUserId: opts.actorUserId,
          previousState: existing.overallState,
        },
      ],
    },
    snapshots: [...existing.snapshots, snapshot],
  };
}

/**
 * Clinician correction — state/limitations/viewStates within approved enums.
 * Prior snapshots and history are preserved (immutable append).
 */
export function correctDonorLongitudinalComparison(
  existing: DonorLongitudinalComparisonRecord,
  opts: {
    nextState: DonorLongitudinalComparisonState;
    actorUserId: string;
    at?: string;
    limitations?: readonly DonorComparabilityLimitation[] | null;
    viewStates?: Partial<
      Record<DonorComparisonView, DonorLongitudinalComparisonState>
    > | null;
  }
): DonorLongitudinalComparisonRecord {
  if (!isDonorLongitudinalComparisonState(opts.nextState)) {
    throw new Error("Invalid donor longitudinal comparison state");
  }
  const at = opts.at ?? new Date().toISOString();
  const previousState = existing.overallState;
  const overallState = opts.nextState;
  const limitations =
    opts.limitations != null
      ? normalizeLimitations(opts.limitations)
      : existing.comparability.limitations;

  let comparability: DonorComparability = {
    ...existing.comparability,
    limitations,
  };
  if (opts.limitations != null) {
    comparability = evaluateDonorComparability({
      sets: existing.sets,
      pairs: existing.pairs,
      limitations,
      answers: null,
    });
  }

  const viewStates: Partial<
    Record<DonorComparisonView, DonorLongitudinalComparisonState>
  > = { ...existing.viewStates };
  if (opts.viewStates) {
    for (const view of DONOR_COMPARISON_VIEWS) {
      const s = opts.viewStates[view];
      if (isDonorLongitudinalComparisonState(s)) {
        viewStates[view] = s;
      }
    }
  } else {
    for (const view of Object.keys(viewStates) as DonorComparisonView[]) {
      viewStates[view] = overallState;
    }
  }

  const patientLabel = assertPatientSafeDonorComparisonText(
    donorLongitudinalComparisonLabel(overallState)
  );
  const narrative = assertPatientSafeDonorComparisonText(
    buildDonorLongitudinalNarrative(overallState)
  );

  const nextRecord: DonorLongitudinalComparisonRecord = {
    ...existing,
    overallState,
    patientLabel,
    narrative,
    viewStates,
    comparability,
    provenance: {
      ...existing.provenance,
      source: "clinician_correction",
      confirmedAt: at,
      confirmedByUserId: opts.actorUserId,
      correctedFrom: previousState,
      history: [
        ...existing.provenance.history,
        {
          at,
          source: "clinician_correction",
          state: overallState,
          actorUserId: opts.actorUserId,
          previousState,
        },
      ],
    },
    snapshots: existing.snapshots,
  };

  const snapshot = buildComparisonSnapshot({
    record: nextRecord,
    source: "clinician_correction",
    actorUserId: opts.actorUserId,
    at,
  });

  return {
    ...nextRecord,
    snapshots: [...existing.snapshots, snapshot],
  };
}

/**
 * Resolve for report: clinician-reviewed records are immutable;
 * automated preparation is rebuilt from current evidence.
 */
export function resolveDonorLongitudinalComparisonForReport(
  input: BuildDonorLongitudinalInput & { stored?: unknown }
): DonorLongitudinalComparisonRecord | null {
  const fromStored = isDonorLongitudinalComparisonRecord(input.stored)
    ? input.stored
    : isDonorLongitudinalComparisonRecord(input.summary?.donor_longitudinal_comparison)
      ? (input.summary!.donor_longitudinal_comparison as DonorLongitudinalComparisonRecord)
      : null;

  if (fromStored && isClinicianReviewedDonorComparison(fromStored)) {
    return fromStored;
  }

  return buildAutomatedDonorLongitudinalComparison(input);
}

/**
 * Patient-facing slice — returns null unless clinician confirmed/corrected.
 */
export function toPatientSafeDonorLongitudinalSlice(
  record: DonorLongitudinalComparisonRecord,
  opts?: {
    urlByUploadId?: Record<string, string | null | undefined>;
  }
): PatientSafeDonorLongitudinalSlice | null {
  if (!isClinicianReviewedDonorComparison(record)) {
    return null;
  }

  const setById = new Map(record.sets.map((s) => [s.id, s]));
  const urlByUploadId = opts?.urlByUploadId ?? {};

  const viewStates: PatientSafeDonorLongitudinalSlice["viewStates"] = {};
  for (const view of DONOR_COMPARISON_VIEWS) {
    const state = record.viewStates[view];
    if (!isDonorLongitudinalComparisonState(state)) continue;
    viewStates[view] = {
      state,
      label: assertPatientSafeDonorComparisonText(
        donorLongitudinalComparisonLabel(state)
      ),
    };
  }

  const pairs = record.pairs.map((p) => {
    const baselineSet = setById.get(p.baselineSetId);
    const compareSet = setById.get(p.compareSetId);
    return {
      view: p.view,
      viewLabel: VIEW_LABELS[p.view],
      baseline: {
        label: baselineSet?.label ?? "Earlier set",
        signedUrl:
          p.baseline.signedUrl ?? urlByUploadId[p.baseline.uploadId] ?? null,
      },
      compare: {
        label: compareSet?.label ?? "Later set",
        signedUrl:
          p.compare.signedUrl ?? urlByUploadId[p.compare.uploadId] ?? null,
      },
    };
  });

  return {
    overallState: record.overallState,
    label: assertPatientSafeDonorComparisonText(record.patientLabel),
    narrative: assertPatientSafeDonorComparisonText(record.narrative),
    caveat: DONOR_LONGITUDINAL_IMAGE_CAVEAT,
    viewStates,
    limitations: [...record.comparability.limitations],
    pairs,
    provenanceLabel: provenanceLabelForDonorComparison(record.provenance.source),
    provenanceSource: record.provenance.source,
  };
}

export function collectPatientFacingDonorComparisonTexts(
  slice: PatientSafeDonorLongitudinalSlice
): string[] {
  const texts = [slice.label, slice.narrative, slice.caveat, slice.provenanceLabel];
  for (const v of Object.values(slice.viewStates)) {
    if (v?.label) texts.push(v.label);
  }
  return texts.filter((t): t is string => typeof t === "string" && t.length > 0);
}

export function patientFacingDonorComparisonContainsForbiddenLanguage(
  slice: PatientSafeDonorLongitudinalSlice
): boolean {
  return collectPatientFacingDonorComparisonTexts(slice).some((t) =>
    containsForbiddenDonorDiagnosticLanguage(t)
  );
}
