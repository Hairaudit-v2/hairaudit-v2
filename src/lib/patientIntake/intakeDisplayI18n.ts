/**
 * Batch 12: multilingual **display** layer for patient intake (`patientAuditForm.ts`).
 *
 * - Canonical field ids and option **values** come only from `PATIENT_AUDIT_SECTIONS` and are
 *   what we submit and validate; they stay ASCII / English-stable.
 * - This module maps question id → optional i18n keys for **prompt**, **help**, **placeholder**,
 *   and per-option **labels**. Missing keys fall back to the strings on `PatientFormQuestion`.
 *
 * Add new entries to `PATIENT_INTAKE_QUESTION_DISPLAY` and matching keys in `en.json` / `es.json`.
 * Prefer reusing existing keys (e.g. `dashboard.patient.forms.reviewEnums.*`) for option labels
 * when review summary already localizes the same value set.
 */

import type { TranslateFn } from "@/lib/i18n/getTranslation";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { PatientFormQuestion } from "@/lib/patientAuditForm";

export type PatientIntakeQuestionDisplaySpec = {
  promptKey?: TranslationKey;
  helpKey?: TranslationKey;
  placeholderKey?: TranslationKey;
  /** Canonical `option.value` → translation key for visible label only. */
  optionLabelKeys?: Partial<Record<string, TranslationKey>>;
};

function resolveKeyOrFallback(t: TranslateFn, key: TranslationKey | undefined, fallback: string): string {
  if (!key) return fallback;
  const out = t(key);
  return out === key ? fallback : out;
}

/**
 * Registry of intake questions that have localized display copy beyond English fallback.
 * Unlisted questions use `patientAuditForm` strings only.
 */
export const PATIENT_INTAKE_QUESTION_DISPLAY: Partial<Record<string, PatientIntakeQuestionDisplaySpec>> = {
  clinic_name: {
    promptKey: "dashboard.patient.forms.intakeFields.clinic_name.prompt",
    placeholderKey: "dashboard.patient.forms.intakeFields.clinic_name.placeholder",
  },
  preop_consult: {
    promptKey: "dashboard.patient.forms.intakeFields.preop_consult.prompt",
  },
  procedure_type: {
    promptKey: "dashboard.patient.forms.intakeFields.procedure_type.prompt",
    helpKey: "dashboard.patient.forms.intakeFields.procedure_type.help",
    optionLabelKeys: {
      fue: "dashboard.patient.forms.reviewEnums.procedure_type.fue",
      fut: "dashboard.patient.forms.reviewEnums.procedure_type.fut",
      dhi: "dashboard.patient.forms.reviewEnums.procedure_type.dhi",
      robotic: "dashboard.patient.forms.reviewEnums.procedure_type.robotic",
      not_sure: "dashboard.patient.forms.reviewEnums.procedure_type.not_sure",
      other: "dashboard.patient.forms.reviewEnums.procedure_type.other",
    },
  },
};

export function resolvePatientIntakePrompt(t: TranslateFn, q: Pick<PatientFormQuestion, "id" | "prompt">): string {
  const spec = PATIENT_INTAKE_QUESTION_DISPLAY[q.id];
  return resolveKeyOrFallback(t, spec?.promptKey, q.prompt);
}

export function resolvePatientIntakeHelp(t: TranslateFn, q: Pick<PatientFormQuestion, "id" | "help">): string | undefined {
  const spec = PATIENT_INTAKE_QUESTION_DISPLAY[q.id];
  if (spec?.helpKey) {
    const fallback = q.help ?? "";
    const resolved = resolveKeyOrFallback(t, spec.helpKey, fallback);
    return resolved === "" ? undefined : resolved;
  }
  return q.help;
}

export function resolvePatientIntakePlaceholder(
  t: TranslateFn,
  q: Pick<PatientFormQuestion, "id" | "placeholder">,
): string | undefined {
  const spec = PATIENT_INTAKE_QUESTION_DISPLAY[q.id];
  if (spec?.placeholderKey) {
    const fallback = q.placeholder ?? "";
    const resolved = resolveKeyOrFallback(t, spec.placeholderKey, fallback);
    return resolved === "" ? undefined : resolved;
  }
  return q.placeholder;
}

/** Visible label for a select/checkbox option; `option.value` submitted to API is unchanged. */
export function resolvePatientIntakeOptionDisplayLabel(
  t: TranslateFn,
  questionId: string,
  optionValue: string,
  canonicalLabel: string,
): string {
  const spec = PATIENT_INTAKE_QUESTION_DISPLAY[questionId];
  const key = spec?.optionLabelKeys?.[optionValue];
  return resolveKeyOrFallback(t, key, canonicalLabel);
}
