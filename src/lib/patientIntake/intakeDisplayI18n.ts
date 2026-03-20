/**
 * Multilingual **display** layer for patient intake (`patientAuditForm.ts`).
 *
 * - Canonical field ids and option **values** come only from `PATIENT_AUDIT_SECTIONS` and are what
 *   we submit and validate; they stay ASCII / English-stable.
 * - Copy lives under `dashboard.patient.forms.intakeFields` in locale bundles (generated + merged).
 * - Option labels for a fixed review set reuse `dashboard.patient.forms.reviewEnums.<questionId>.<value>`.
 * - Missing bundle entries fall back to strings on `PatientFormQuestion` / option.label.
 *
 * Option keys with spaces (e.g. "Prefer not to say") are resolved via `getIntakeFieldOptionLabel`
 * (bracket walk), not dotted translation paths.
 */

import type { TranslateFn } from "@/lib/i18n/getTranslation";
import {
  getIntakeFieldHelp,
  getIntakeFieldOptionLabel,
  getIntakeFieldPlaceholder,
  getIntakeFieldPrompt,
} from "@/lib/i18n/getTranslation";
import type { PatientFormQuestion } from "@/lib/patientAuditForm";

/** Same ids as review summary enum formatting — option labels shared with `reviewEnums.*`. */
export const PATIENT_INTAKE_REVIEW_ENUM_QUESTION_IDS = new Set([
  "clinic_country",
  "procedure_type",
  "donor_shaving",
  "surgery_duration",
  "post_op_swelling",
  "bleeding_issue",
  "recovery_time",
  "shock_loss",
  "months_since",
  "would_repeat",
]);

export function resolvePatientIntakePrompt(
  _t: TranslateFn,
  locale: string,
  q: Pick<PatientFormQuestion, "id" | "prompt">,
): string {
  return getIntakeFieldPrompt(locale, q.id) ?? q.prompt;
}

export function resolvePatientIntakeHelp(
  _t: TranslateFn,
  locale: string,
  q: Pick<PatientFormQuestion, "id" | "help">,
): string | undefined {
  const fromBundle = getIntakeFieldHelp(locale, q.id);
  if (fromBundle !== undefined) return fromBundle;
  return q.help;
}

export function resolvePatientIntakePlaceholder(
  _t: TranslateFn,
  locale: string,
  q: Pick<PatientFormQuestion, "id" | "placeholder">,
): string | undefined {
  const fromBundle = getIntakeFieldPlaceholder(locale, q.id);
  if (fromBundle !== undefined) return fromBundle;
  return q.placeholder;
}

/** Visible label for a select/checkbox option; `option.value` submitted to API is unchanged. */
export function resolvePatientIntakeOptionDisplayLabel(
  t: TranslateFn,
  locale: string,
  questionId: string,
  optionValue: string,
  canonicalLabel: string,
): string {
  if (PATIENT_INTAKE_REVIEW_ENUM_QUESTION_IDS.has(questionId)) {
    const path = `dashboard.patient.forms.reviewEnums.${questionId}.${optionValue}`;
    const tr = t(path);
    if (tr !== path) return tr;
    return canonicalLabel;
  }
  return getIntakeFieldOptionLabel(locale, questionId, optionValue) ?? canonicalLabel;
}
