import OpenAI from "openai";
import type { SupportedLocale } from "@/lib/i18n/constants";
import {
  canServeReviewedNarrativeTranslation,
  getReportNarrativeTranslationPolicy,
  isReportNarrativeTranslationStale,
  type ReportNarrativeSourceSnapshot,
  type ReportNarrativeTranslationSection,
  type ReportNarrativeTranslationStatus,
  type ReportNarrativeTranslationReviewStatus,
} from "@/lib/i18n/reportTranslationBlueprint";
import { maxTokensParam } from "@/lib/ai/openaiTokenCompat";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";
import { isPatientSafeSummaryTranslationPilotEnabled } from "@/lib/features/enablePatientSafeSummaryTranslationPilot";
import type { PatientSafeSummaryObservation } from "./patientSafeSummary";

export const PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT_LOCALES = ["es"] as const;
export const PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID = "patientSafeSummaryNarrative" as const;

type PatientSafeSummaryTranslationPilotLocale = (typeof PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT_LOCALES)[number];

type ReportNarrativeTranslationRow = {
  id?: string;
  case_id: string;
  report_id: string;
  report_version: number;
  section_id: string;
  source_locale: "en";
  source_content_locale: string;
  source_text_snapshot: string;
  source_content_version: string;
  translated_text: string;
  translated_items: unknown;
  target_locale: SupportedLocale;
  translation_status: ReportNarrativeTranslationStatus;
  review_status: ReportNarrativeTranslationReviewStatus;
  translation_provenance: string | null;
  translated_at: string | null;
  reviewed_at: string | null;
  reviewer_id: string | null;
  review_notes: string | null;
  stale_detected_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TranslationDbClient = {
  from: (table: string) => {
    select: (columns: string) => any;
    upsert: (value: Record<string, unknown>, options?: Record<string, unknown>) => any;
    update: (value: Record<string, unknown>) => any;
  };
};

export type PatientSafeSummaryNarrativePresentation = {
  observations: PatientSafeSummaryObservation[];
  narrativeLocale: "en" | SupportedLocale;
  translatedNarrativeAvailable: boolean;
  translatedNarrativeActive: boolean;
  translationStatus: "english_fallback" | "translated_pilot";
  fallbackReason?:
    | "pilot_disabled"
    | "unsupported_locale"
    | "missing_db"
    | "missing_report_context"
    | "no_source_observations"
    | "no_stored_translation"
    | "stored_translation_not_servable"
    | "generation_failed";
  trace: {
    pilotEnabled: boolean;
    requestedLocale: SupportedLocale;
    targetLocale: PatientSafeSummaryTranslationPilotLocale | null;
    usedStoredTranslation: boolean;
    generatedThisRequest: boolean;
    staleDetected: boolean;
    serveDecision:
      | "served"
      | "unsupported_locale"
      | "wrong_section"
      | "review_rejected"
      | "translated_items_invalid"
      | "stale_source_snapshot"
      | "status_not_allowed";
  };
};

type ResolvePatientSafeSummaryNarrativeArgs = {
  db: TranslationDbClient | null;
  caseId: string;
  reportId: string | null | undefined;
  reportVersion: number | null | undefined;
  requestedLocale: SupportedLocale;
  sourceObservations: PatientSafeSummaryObservation[];
  sourceContentLocale?: string | null;
  forceRefresh?: boolean;
};

export type PatientSafeSummaryTranslationOpsState = {
  pilotEnabled: boolean;
  requestedLocale: SupportedLocale;
  targetLocale: PatientSafeSummaryTranslationPilotLocale | null;
  hasStoredTranslation: boolean;
  translationStatus: ReportNarrativeTranslationStatus | "not_available";
  reviewStatus: ReportNarrativeTranslationReviewStatus | "not_available";
  serveDecision:
    | "served"
    | "unsupported_locale"
    | "wrong_section"
    | "review_rejected"
    | "translated_items_invalid"
    | "stale_source_snapshot"
    | "status_not_allowed"
    | "not_available";
  fallbackReason?: PatientSafeSummaryNarrativePresentation["fallbackReason"];
  translationProvenance?: string;
  translatedAt?: string | null;
  reviewedAt?: string | null;
};

const PATIENT_SAFE_SUMMARY_TRANSLATION_JSON_SCHEMA = {
  name: "patient_safe_summary_translation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
            },
          },
          required: ["text"],
        },
      },
    },
    required: ["items"],
  },
} as const;

export function getPatientSafeSummaryPilotTargetLocale(
  locale: SupportedLocale
): PatientSafeSummaryTranslationPilotLocale | null {
  return locale === "es" ? locale : null;
}

export function createPatientSafeSummaryNarrativeContentVersion(reportId: string, reportVersion: number): string {
  return `report:${reportId}:v${reportVersion}:patientSafeSummaryNarrative`;
}

export function createPatientSafeSummaryNarrativeSourceSnapshot(args: {
  observations: PatientSafeSummaryObservation[];
  reportId: string;
  reportVersion: number;
  sourceContentLocale?: string | null;
}): ReportNarrativeSourceSnapshot {
  return {
    locale: "en",
    sourceContentLocale: (args.sourceContentLocale?.trim() || "und") as ReportNarrativeSourceSnapshot["sourceContentLocale"],
    text: serializePatientSafeSummaryObservationTexts(args.observations),
    contentVersion: createPatientSafeSummaryNarrativeContentVersion(args.reportId, args.reportVersion),
  };
}

export function canServePatientSafeSummaryNarrativeTranslation(args: {
  section: ReportNarrativeTranslationSection;
  requestedLocale: SupportedLocale;
  currentSourceText: string;
  currentContentVersion: string;
  translatedItems: string[];
  sourceObservationCount: number;
}): boolean {
  return evaluatePatientSafeSummaryNarrativeTranslationDecision(args).canServe;
}

export function evaluatePatientSafeSummaryNarrativeTranslationDecision(args: {
  section: ReportNarrativeTranslationSection;
  requestedLocale: SupportedLocale;
  currentSourceText: string;
  currentContentVersion: string;
  translatedItems: string[];
  sourceObservationCount: number;
}): {
  canServe: boolean;
  reason:
    | "served"
    | "unsupported_locale"
    | "wrong_section"
    | "review_rejected"
    | "translated_items_invalid"
    | "stale_source_snapshot"
    | "status_not_allowed";
} {
  if (getPatientSafeSummaryPilotTargetLocale(args.requestedLocale) !== args.section.targetLocale) {
    return { canServe: false, reason: "unsupported_locale" };
  }
  if (args.section.sectionId !== PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID) {
    return { canServe: false, reason: "wrong_section" };
  }
  if (args.section.review.status === "rejected") {
    return { canServe: false, reason: "review_rejected" };
  }
  if (args.translatedItems.length !== args.sourceObservationCount || args.translatedItems.some((item) => !item.trim())) {
    return { canServe: false, reason: "translated_items_invalid" };
  }

  if (
    isReportNarrativeTranslationStale({
      sourceSnapshot: args.section.sourceSnapshot,
      currentSourceText: args.currentSourceText,
      currentContentVersion: args.currentContentVersion,
    })
  ) {
    return { canServe: false, reason: "stale_source_snapshot" };
  }

  if (canServeReviewedNarrativeTranslation(args.section)) return { canServe: true, reason: "served" };

  const allowedGenerated =
    args.section.status === "generated_unreviewed" &&
    args.section.policy.humanReviewRequirement !== "required" &&
    Boolean(args.section.translatedText?.trim());

  return allowedGenerated ? { canServe: true, reason: "served" } : { canServe: false, reason: "status_not_allowed" };
}

export async function resolvePatientSafeSummaryNarrativePresentation(
  args: ResolvePatientSafeSummaryNarrativeArgs
): Promise<PatientSafeSummaryNarrativePresentation> {
  const pilotEnabled = isPatientSafeSummaryTranslationPilotEnabled();
  const targetLocale = getPatientSafeSummaryPilotTargetLocale(args.requestedLocale);
  const baseTrace = {
    pilotEnabled,
    requestedLocale: args.requestedLocale,
    targetLocale,
    usedStoredTranslation: false,
    generatedThisRequest: false,
    staleDetected: false,
    serveDecision: "status_not_allowed" as PatientSafeSummaryNarrativePresentation["trace"]["serveDecision"],
  };
  const fallback = createEnglishFallbackPresentation(args.sourceObservations, baseTrace);

  if (!pilotEnabled) return { ...fallback, fallbackReason: "pilot_disabled" };
  if (!targetLocale) return { ...fallback, fallbackReason: "unsupported_locale", trace: { ...baseTrace, serveDecision: "unsupported_locale" } };
  if (!args.db) return { ...fallback, fallbackReason: "missing_db" };
  if (!args.reportId || !args.reportVersion) return { ...fallback, fallbackReason: "missing_report_context" };
  if (args.sourceObservations.length === 0) return { ...fallback, fallbackReason: "no_source_observations" };

  const sourceSnapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: args.sourceObservations,
    reportId: args.reportId,
    reportVersion: args.reportVersion,
    sourceContentLocale: args.sourceContentLocale,
  });

  const existing = await readStoredPatientSafeSummaryTranslation(args.db, {
    reportId: args.reportId,
    targetLocale,
  });

  if (existing && !args.forceRefresh) {
    const served = maybeServeStoredTranslation({
      row: existing,
      requestedLocale: args.requestedLocale,
      sourceObservations: args.sourceObservations,
      sourceSnapshot,
    });
    if (served) return { ...served, trace: { ...served.trace, usedStoredTranslation: true } };

    fallback.trace.staleDetected = true;
    await markStoredPatientSafeSummaryTranslationStale(args.db, existing.id as string, sourceSnapshot.contentVersion ?? "");
  }

  const generated = await generatePatientSafeSummaryTranslation({
    targetLocale,
    sourceObservations: args.sourceObservations,
  });

  if (!generated) {
    return {
      ...fallback,
      fallbackReason: existing ? "stored_translation_not_servable" : "generation_failed",
    };
  }

  const stored = await upsertPatientSafeSummaryTranslation(args.db, {
    caseId: args.caseId,
    reportId: args.reportId,
    reportVersion: args.reportVersion,
    targetLocale,
    sourceSnapshot,
    translatedItems: generated.items,
    translationProvenance: generated.translationProvenance,
  });

  const rowToUse = stored ?? materializeUnpersistedTranslationRow({
    caseId: args.caseId,
    reportId: args.reportId,
    reportVersion: args.reportVersion,
    targetLocale,
    sourceSnapshot,
    translatedItems: generated.items,
    translationProvenance: generated.translationProvenance,
  });

  const served = maybeServeStoredTranslation({
    row: rowToUse,
    requestedLocale: args.requestedLocale,
    sourceObservations: args.sourceObservations,
    sourceSnapshot,
  });
  if (!served) return { ...fallback, fallbackReason: "stored_translation_not_servable" };
  return { ...served, trace: { ...served.trace, generatedThisRequest: true } };
}

function createEnglishFallbackPresentation(
  observations: PatientSafeSummaryObservation[],
  trace: PatientSafeSummaryNarrativePresentation["trace"]
): PatientSafeSummaryNarrativePresentation {
  return {
    observations,
    narrativeLocale: "en",
    translatedNarrativeAvailable: false,
    translatedNarrativeActive: false,
    translationStatus: "english_fallback",
    trace,
  };
}

function serializePatientSafeSummaryObservationTexts(observations: PatientSafeSummaryObservation[]): string {
  return observations.map((item, idx) => `${idx + 1}. [${item.stage}] ${item.text.trim()}`).join("\n");
}

function parseStoredTranslatedItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in (item as Record<string, unknown>)) {
        return String((item as Record<string, unknown>).text ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function buildTranslatedObservations(
  sourceObservations: PatientSafeSummaryObservation[],
  translatedItems: string[]
): PatientSafeSummaryObservation[] {
  return sourceObservations.map((item, idx) => ({
    stage: item.stage,
    text: translatedItems[idx] ?? item.text,
  }));
}

function buildSectionFromRow(row: ReportNarrativeTranslationRow): ReportNarrativeTranslationSection {
  return {
    sectionId: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
    sourceLocale: "en",
    targetLocale: row.target_locale,
    status: row.translation_status,
    policy: getReportNarrativeTranslationPolicy(PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID),
    sourceSnapshot: {
      locale: "en",
      sourceContentLocale: row.source_content_locale as ReportNarrativeSourceSnapshot["sourceContentLocale"],
      text: row.source_text_snapshot,
      contentVersion: row.source_content_version,
    },
    translatedText: row.translated_text,
    translatedAt: row.translated_at ?? undefined,
    translationProvenance: row.translation_provenance ?? undefined,
    review: {
      status: row.review_status,
      reviewedAt: row.reviewed_at ?? undefined,
      reviewerId: row.reviewer_id ?? undefined,
      reviewNotes: row.review_notes ?? undefined,
    },
    staleDetectedAt: row.stale_detected_at ?? undefined,
  };
}

function maybeServeStoredTranslation(args: {
  row: ReportNarrativeTranslationRow;
  requestedLocale: SupportedLocale;
  sourceObservations: PatientSafeSummaryObservation[];
  sourceSnapshot: ReportNarrativeSourceSnapshot;
}): PatientSafeSummaryNarrativePresentation | null {
  const translatedItems = parseStoredTranslatedItems(args.row.translated_items);
  const section = buildSectionFromRow(args.row);
  const decision = evaluatePatientSafeSummaryNarrativeTranslationDecision({
    section,
    requestedLocale: args.requestedLocale,
    currentSourceText: args.sourceSnapshot.text,
    currentContentVersion: args.sourceSnapshot.contentVersion ?? "",
    translatedItems,
    sourceObservationCount: args.sourceObservations.length,
  });

  if (!decision.canServe) {
    return null;
  }

  const staleDetected = decision.reason === "stale_source_snapshot";
  return {
    observations: buildTranslatedObservations(args.sourceObservations, translatedItems),
    narrativeLocale: args.row.target_locale,
    translatedNarrativeAvailable: true,
    translatedNarrativeActive: true,
    translationStatus: "translated_pilot",
    trace: {
      pilotEnabled: isPatientSafeSummaryTranslationPilotEnabled(),
      requestedLocale: args.requestedLocale,
      targetLocale: getPatientSafeSummaryPilotTargetLocale(args.requestedLocale),
      usedStoredTranslation: true,
      generatedThisRequest: false,
      staleDetected,
      serveDecision: decision.reason,
    },
  };
}

export async function getPatientSafeSummaryTranslationOpsState(
  args: ResolvePatientSafeSummaryNarrativeArgs
): Promise<PatientSafeSummaryTranslationOpsState> {
  const presentation = await resolvePatientSafeSummaryNarrativePresentation(args);
  const targetLocale = getPatientSafeSummaryPilotTargetLocale(args.requestedLocale);
  const base: PatientSafeSummaryTranslationOpsState = {
    pilotEnabled: isPatientSafeSummaryTranslationPilotEnabled(),
    requestedLocale: args.requestedLocale,
    targetLocale,
    hasStoredTranslation: false,
    translationStatus: "not_available",
    reviewStatus: "not_available",
    serveDecision: presentation.trace.serveDecision,
    fallbackReason: presentation.fallbackReason,
  };

  if (!args.db || !args.reportId || !targetLocale) return base;

  const existing = await readStoredPatientSafeSummaryTranslation(args.db, {
    reportId: args.reportId,
    targetLocale,
  });
  if (!existing) return base;

  return {
    ...base,
    hasStoredTranslation: true,
    translationStatus: existing.translation_status,
    reviewStatus: existing.review_status,
    translationProvenance: existing.translation_provenance ?? undefined,
    translatedAt: existing.translated_at,
    reviewedAt: existing.reviewed_at,
  };
}

export async function refreshPatientSafeSummaryNarrativeTranslation(
  args: ResolvePatientSafeSummaryNarrativeArgs
): Promise<PatientSafeSummaryNarrativePresentation> {
  return resolvePatientSafeSummaryNarrativePresentation({ ...args, forceRefresh: true });
}

export async function setPatientSafeSummaryNarrativeReviewStatus(args: {
  db: TranslationDbClient | null;
  reportId: string;
  targetLocale: SupportedLocale;
  reviewStatus: "approved" | "rejected" | "not_reviewed";
  reviewerId?: string | null;
  reviewNotes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const targetLocale = getPatientSafeSummaryPilotTargetLocale(args.targetLocale);
  if (!args.db || !targetLocale) return { ok: false, error: "Unsupported locale or database unavailable." };

  try {
    const now = new Date().toISOString();
    const status: ReportNarrativeTranslationStatus =
      args.reviewStatus === "approved" ? "reviewed_approved" : "generated_unreviewed";

    const res = await args.db
      .from("report_narrative_translations")
      .update({
        review_status: args.reviewStatus,
        translation_status: status,
        reviewed_at: args.reviewStatus === "not_reviewed" ? null : now,
        reviewer_id: args.reviewStatus === "not_reviewed" ? null : args.reviewerId ?? null,
        review_notes: args.reviewNotes ?? null,
        updated_at: now,
      })
      .eq("report_id", args.reportId)
      .eq("section_id", PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID)
      .eq("target_locale", targetLocale);

    if (res.error) {
      if (!isMissingFeatureError(res.error)) {
        console.error("[patient-safe-summary-translation] review update failed", res.error);
      }
      return { ok: false, error: String(res.error.message ?? "Could not update review state.") };
    }

    return { ok: true };
  } catch (error) {
    if (!isMissingFeatureError(error)) {
      console.error("[patient-safe-summary-translation] review update threw", error);
    }
    return { ok: false, error: "Could not update review state." };
  }
}

async function readStoredPatientSafeSummaryTranslation(
  db: TranslationDbClient,
  args: { reportId: string; targetLocale: PatientSafeSummaryTranslationPilotLocale }
): Promise<(ReportNarrativeTranslationRow & { id?: string }) | null> {
  try {
    const res = await db
      .from("report_narrative_translations")
      .select(
        "id, case_id, report_id, report_version, section_id, source_locale, source_content_locale, source_text_snapshot, source_content_version, translated_text, translated_items, target_locale, translation_status, review_status, translation_provenance, translated_at, reviewed_at, reviewer_id, review_notes, stale_detected_at, created_at, updated_at"
      )
      .eq("report_id", args.reportId)
      .eq("section_id", PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID)
      .eq("target_locale", args.targetLocale)
      .maybeSingle();

    if (res.error) {
      if (!isMissingFeatureError(res.error)) {
        console.error("[patient-safe-summary-translation] read failed", res.error);
      }
      return null;
    }

    return (res.data as ReportNarrativeTranslationRow & { id?: string } | null) ?? null;
  } catch (error) {
    if (!isMissingFeatureError(error)) {
      console.error("[patient-safe-summary-translation] read threw", error);
    }
    return null;
  }
}

async function markStoredPatientSafeSummaryTranslationStale(
  db: TranslationDbClient,
  rowId: string | undefined,
  currentContentVersion: string
): Promise<void> {
  if (!rowId) return;
  try {
    const res = await db
      .from("report_narrative_translations")
      .update({
        translation_status: "stale_due_to_source_change",
        stale_detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        review_notes: `Marked stale after source changed to ${currentContentVersion}.`,
      })
      .eq("id", rowId);
    if (res.error && !isMissingFeatureError(res.error)) {
      console.error("[patient-safe-summary-translation] stale mark failed", res.error);
    }
  } catch (error) {
    if (!isMissingFeatureError(error)) {
      console.error("[patient-safe-summary-translation] stale mark threw", error);
    }
  }
}

async function upsertPatientSafeSummaryTranslation(
  db: TranslationDbClient,
  args: {
    caseId: string;
    reportId: string;
    reportVersion: number;
    targetLocale: PatientSafeSummaryTranslationPilotLocale;
    sourceSnapshot: ReportNarrativeSourceSnapshot;
    translatedItems: string[];
    translationProvenance: string;
  }
): Promise<ReportNarrativeTranslationRow | null> {
  try {
    const now = new Date().toISOString();
    const payload = {
      case_id: args.caseId,
      report_id: args.reportId,
      report_version: args.reportVersion,
      section_id: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
      source_locale: "en",
      source_content_locale: args.sourceSnapshot.sourceContentLocale,
      source_text_snapshot: args.sourceSnapshot.text,
      source_content_version: args.sourceSnapshot.contentVersion,
      translated_text: args.translatedItems.join("\n"),
      translated_items: args.translatedItems,
      target_locale: args.targetLocale,
      translation_status: "generated_unreviewed",
      review_status: "not_reviewed",
      translation_provenance: args.translationProvenance,
      translated_at: now,
      updated_at: now,
      stale_detected_at: null,
    };

    const res = await db
      .from("report_narrative_translations")
      .upsert(payload, { onConflict: "report_id,section_id,target_locale" })
      .select(
        "case_id, report_id, report_version, section_id, source_locale, source_content_locale, source_text_snapshot, source_content_version, translated_text, translated_items, target_locale, translation_status, review_status, translation_provenance, translated_at, reviewed_at, reviewer_id, review_notes, stale_detected_at, created_at, updated_at"
      )
      .maybeSingle();

    if (res.error) {
      if (!isMissingFeatureError(res.error)) {
        console.error("[patient-safe-summary-translation] upsert failed", res.error);
      }
      return null;
    }

    return (res.data as ReportNarrativeTranslationRow | null) ?? null;
  } catch (error) {
    if (!isMissingFeatureError(error)) {
      console.error("[patient-safe-summary-translation] upsert threw", error);
    }
    return null;
  }
}

function materializeUnpersistedTranslationRow(args: {
  caseId: string;
  reportId: string;
  reportVersion: number;
  targetLocale: PatientSafeSummaryTranslationPilotLocale;
  sourceSnapshot: ReportNarrativeSourceSnapshot;
  translatedItems: string[];
  translationProvenance: string;
}): ReportNarrativeTranslationRow {
  const now = new Date().toISOString();
  return {
    case_id: args.caseId,
    report_id: args.reportId,
    report_version: args.reportVersion,
    section_id: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
    source_locale: "en",
    source_content_locale: args.sourceSnapshot.sourceContentLocale,
    source_text_snapshot: args.sourceSnapshot.text,
    source_content_version: args.sourceSnapshot.contentVersion ?? "",
    translated_text: args.translatedItems.join("\n"),
    translated_items: args.translatedItems,
    target_locale: args.targetLocale,
    translation_status: "generated_unreviewed",
    review_status: "not_reviewed",
    translation_provenance: args.translationProvenance,
    translated_at: now,
    reviewed_at: null,
    reviewer_id: null,
    review_notes: null,
    stale_detected_at: null,
    created_at: now,
    updated_at: now,
  };
}

async function generatePatientSafeSummaryTranslation(args: {
  targetLocale: PatientSafeSummaryTranslationPilotLocale;
  sourceObservations: PatientSafeSummaryObservation[];
}): Promise<{ items: string[]; translationProvenance: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const tokenParam = maxTokensParam(model, 600);

  const systemPrompt = [
    "You translate HairAudit patient-safe summary observations from English into patient-friendly Spanish.",
    "STRICT RULES:",
    "- Preserve meaning, caution, uncertainty, and sequence exactly.",
    "- Do not diagnose, prescribe, or add medical advice.",
    "- Do not add or remove facts, severity, or recommendations.",
    "- Keep numbers, month ranges, and proper names accurate.",
    "- Keep each item concise and natural for a patient-facing summary.",
    "- Return JSON only, matching the schema exactly.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    target_locale: args.targetLocale,
    items: args.sourceObservations.map((item) => item.text),
  });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: { type: "json_schema", json_schema: PATIENT_SAFE_SUMMARY_TRANSLATION_JSON_SCHEMA } as any,
      temperature: 0.2,
      ...(tokenParam as any),
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items?: Array<{ text?: string }> };
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item) => String(item?.text ?? "").trim()).filter(Boolean)
      : [];

    if (items.length !== args.sourceObservations.length) return null;

    return {
      items,
      translationProvenance: `openai:${model}:patient_safe_summary_pilot`,
    };
  } catch (error) {
    console.error("[patient-safe-summary-translation] generation failed", error);
    return null;
  }
}
