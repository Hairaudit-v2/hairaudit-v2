/**
 * HA-DONOR-HEALING-1A — client/session handoff for donor entry context.
 * Product state that must survive auth should also be written to the case
 * report summary at audit start; sessionStorage alone is not durable.
 */

import {
  DONOR_HEALING_ENTRY_CONTEXT,
  DONOR_HEALING_GUIDE_SLUG,
  DONOR_HEALING_RECOMMENDED_PATHWAY,
  DONOR_HEALING_SOURCE_PAGE,
  parseDonorEntryContext,
  parseHairAuditEntryContext,
  parsePostSurgeryConcern,
  withDonorEntryContextQuery,
  type DonorHealingEntryContext,
  type PostSurgeryConcern,
} from "@/lib/patient/donorHealingEntry";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { sanitizeNextPath } from "@/lib/auth/redirects";

const PENDING_ENTRY_CONTEXT_KEY = "hairaudit:pending_entry_context";
const CASE_ENTRY_CONTEXT_PREFIX = "hairaudit:case_entry_context:";

export type PendingPatientEntryContext = {
  entryContext: DonorHealingEntryContext;
  concern?: PostSurgeryConcern | null;
  sourceGuide?: string | null;
  recommendedPathway?: "pre_surgery" | "post_surgery" | null;
  ts: number;
};

const MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 hours

function parseRecommendedPathway(
  value: unknown
): "pre_surgery" | "post_surgery" | null {
  if (value === "pre_surgery" || value === "post_surgery") return value;
  return null;
}

function safeParse(raw: string | null): PendingPatientEntryContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPatientEntryContext>;
    const entryContext = parseDonorEntryContext(parsed.entryContext);
    if (!entryContext) return null;
    if (typeof parsed.ts === "number" && Date.now() - parsed.ts > MAX_AGE_MS) {
      return null;
    }
    return {
      entryContext,
      concern: parsePostSurgeryConcern(parsed.concern) ?? null,
      sourceGuide: typeof parsed.sourceGuide === "string" ? parsed.sourceGuide : null,
      recommendedPathway:
        parseRecommendedPathway(parsed.recommendedPathway) ?? DONOR_HEALING_RECOMMENDED_PATHWAY,
      ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
    };
  } catch {
    return null;
  }
}

export function stashPendingEntryContext(input: {
  entryContext?: unknown;
  concern?: unknown;
  sourceGuide?: string | null;
  recommendedPathway?: "pre_surgery" | "post_surgery" | null;
}): PendingPatientEntryContext | null {
  if (typeof window === "undefined") return null;
  const entryContext =
    parseDonorEntryContext(input.entryContext) ??
    parseDonorEntryContext(input.concern) ??
    null;
  if (!entryContext) return null;
  const payload: PendingPatientEntryContext = {
    entryContext,
    concern: parsePostSurgeryConcern(input.concern) ?? "donor_healing",
    sourceGuide: input.sourceGuide ?? DONOR_HEALING_GUIDE_SLUG,
    recommendedPathway:
      parseRecommendedPathway(input.recommendedPathway) ?? DONOR_HEALING_RECOMMENDED_PATHWAY,
    ts: Date.now(),
  };
  try {
    sessionStorage.setItem(PENDING_ENTRY_CONTEXT_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
  return payload;
}

export function readPendingEntryContext(): PendingPatientEntryContext | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = safeParse(sessionStorage.getItem(PENDING_ENTRY_CONTEXT_KEY));
    if (!parsed) {
      sessionStorage.removeItem(PENDING_ENTRY_CONTEXT_KEY);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingEntryContext(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_ENTRY_CONTEXT_KEY);
  } catch {
    /* ignore */
  }
}

export function bindEntryContextToCase(
  caseId: string,
  ctx: PendingPatientEntryContext | { entryContext: DonorHealingEntryContext }
): void {
  if (typeof window === "undefined" || !caseId) return;
  try {
    sessionStorage.setItem(
      `${CASE_ENTRY_CONTEXT_PREFIX}${caseId}`,
      JSON.stringify({
        entryContext: ctx.entryContext,
        concern: "concern" in ctx ? ctx.concern ?? null : null,
        sourceGuide: "sourceGuide" in ctx ? ctx.sourceGuide ?? null : null,
        recommendedPathway:
          "recommendedPathway" in ctx
            ? ctx.recommendedPathway ?? DONOR_HEALING_RECOMMENDED_PATHWAY
            : DONOR_HEALING_RECOMMENDED_PATHWAY,
        ts: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

export function readCaseBoundEntryContext(caseId: string): PendingPatientEntryContext | null {
  if (typeof window === "undefined" || !caseId) return null;
  try {
    return safeParse(sessionStorage.getItem(`${CASE_ENTRY_CONTEXT_PREFIX}${caseId}`));
  } catch {
    return null;
  }
}

/** Build chooser href that carries validated donor concern for pre-highlight / stash. */
export function buildDonorHealingChooserHref(opts?: {
  concern?: PostSurgeryConcern;
  sourceGuide?: string;
}): string {
  const concern = opts?.concern ?? "donor_healing";
  const source = opts?.sourceGuide ?? DONOR_HEALING_SOURCE_PAGE;
  const params = new URLSearchParams({
    concern,
    entry_context: DONOR_HEALING_ENTRY_CONTEXT,
    recommended_pathway: DONOR_HEALING_RECOMMENDED_PATHWAY,
    source_page: source,
    entry_source: source,
  });
  return `/request-review?${params.toString()}#choose-pathway`;
}

export function parseEntryContextFromSearchParams(
  search: string | URLSearchParams
): PendingPatientEntryContext | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;

  // Reject reserved-but-unimplemented entry_context tokens explicitly.
  const rawEntry = params.get("entry_context");
  if (rawEntry && !parseHairAuditEntryContext(rawEntry) && !parseDonorEntryContext(rawEntry)) {
    return null;
  }

  const entryContext =
    parseDonorEntryContext(params.get("entry_context")) ??
    parseDonorEntryContext(params.get("concern"));
  if (!entryContext) return null;

  const recommended =
    parseRecommendedPathway(params.get("recommended_pathway")) ?? DONOR_HEALING_RECOMMENDED_PATHWAY;

  return {
    entryContext,
    concern: parsePostSurgeryConcern(params.get("concern")) ?? "donor_healing",
    sourceGuide:
      params.get("source_page") ?? params.get("entry_source") ?? DONOR_HEALING_GUIDE_SLUG,
    recommendedPathway: recommended,
    ts: Date.now(),
  };
}

/** Default public chooser when no donor context — keep architecture contract. */
export function pathwayChooserHrefOrDonor(hasDonorContext: boolean): string {
  return hasDonorContext ? buildDonorHealingChooserHref() : PATHWAY_CHOOSER_HREF;
}

/**
 * Auth-return continuity: prefer explicit sanitized `next`.
 * If `next` is missing/generic dashboard and a pending donor context exists,
 * return to the donor-focused pathway chooser instead of a bare dashboard.
 */
export function resolveDonorAwareAuthReturnPath(
  nextParam: string | null | undefined,
  pending: PendingPatientEntryContext | null
): string | null {
  const sanitized = sanitizeNextPath(nextParam);
  if (sanitized) {
    const isGenericDashboard =
      sanitized === "/dashboard" ||
      sanitized === "/dashboard/patient" ||
      sanitized === "/dashboard/";
    if (isGenericDashboard && pending?.entryContext === DONOR_HEALING_ENTRY_CONTEXT) {
      return buildDonorHealingChooserHref({
        concern: pending.concern ?? "donor_healing",
        sourceGuide: pending.sourceGuide ?? DONOR_HEALING_GUIDE_SLUG,
      });
    }
    if (pending?.entryContext === DONOR_HEALING_ENTRY_CONTEXT) {
      return withDonorEntryContextQuery(sanitized, pending.entryContext);
    }
    return sanitized;
  }
  if (pending?.entryContext === DONOR_HEALING_ENTRY_CONTEXT) {
    return buildDonorHealingChooserHref({
      concern: pending.concern ?? "donor_healing",
      sourceGuide: pending.sourceGuide ?? DONOR_HEALING_GUIDE_SLUG,
    });
  }
  return null;
}
