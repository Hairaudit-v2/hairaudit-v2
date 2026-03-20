import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "@/lib/i18n/constants";
import en from "@/lib/i18n/translations/en.json";
import es from "@/lib/i18n/translations/es.json";

type AuditDisplayActor = "doctor" | "clinic";
type Bundle = Record<string, unknown>;
type DisplayQuestionBase = {
  id: string;
  prompt: string;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};
type DisplaySectionBase = {
  id: string;
  title: string;
};

const BUNDLES: Record<SupportedLocale, Bundle> = {
  en: en as Bundle,
  es: es as Bundle,
};

function walk(parts: string[], locale: SupportedLocale): unknown {
  let cur: unknown = BUNDLES[locale];
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Bundle)[p];
  }
  return cur;
}

function getRecord(parts: string[], locale: string): Bundle | undefined {
  const loc = normalizeLocale(locale);
  const primary = walk(parts, loc);
  if (primary && typeof primary === "object" && !Array.isArray(primary)) return primary as Bundle;
  if (loc !== DEFAULT_LOCALE) {
    const fallback = walk(parts, DEFAULT_LOCALE);
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) return fallback as Bundle;
  }
  return undefined;
}

function getString(parts: string[], locale: string): string | undefined {
  const loc = normalizeLocale(locale);
  const primary = walk(parts, loc);
  if (typeof primary === "string" && primary.length > 0) return primary;
  if (loc !== DEFAULT_LOCALE) {
    const fallback = walk(parts, DEFAULT_LOCALE);
    if (typeof fallback === "string" && fallback.length > 0) return fallback;
  }
  return undefined;
}

function baseParts(actor: AuditDisplayActor) {
  return ["dashboard", actor, "forms", "caseAudit"];
}

export function resolveAuditSectionTitle(
  actor: AuditDisplayActor,
  locale: string,
  section: DisplaySectionBase,
): string {
  return getString([...baseParts(actor), "sections", section.id, "title"], locale) ?? section.title;
}

export function resolveAuditPrompt(
  actor: AuditDisplayActor,
  locale: string,
  question: Pick<DisplayQuestionBase, "id" | "prompt">,
): string {
  return getString([...baseParts(actor), "fields", question.id, "prompt"], locale) ?? question.prompt;
}

export function resolveAuditHelp(
  actor: AuditDisplayActor,
  locale: string,
  question: Pick<DisplayQuestionBase, "id" | "help">,
): string | undefined {
  return getString([...baseParts(actor), "fields", question.id, "help"], locale) ?? question.help;
}

export function resolveAuditPlaceholder(
  actor: AuditDisplayActor,
  locale: string,
  question: Pick<DisplayQuestionBase, "id" | "placeholder">,
): string | undefined {
  return getString([...baseParts(actor), "fields", question.id, "placeholder"], locale) ?? question.placeholder;
}

export function resolveAuditOptionLabel(
  actor: AuditDisplayActor,
  locale: string,
  questionId: string,
  optionValue: string,
  fallback: string,
): string {
  const record = getRecord([...baseParts(actor), "fields", questionId, "options"], locale);
  const value = record?.[optionValue];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function localizeAuditQuestion<T extends DisplayQuestionBase>(
  actor: AuditDisplayActor,
  locale: string,
  question: T,
): T {
  return {
    ...question,
    prompt: resolveAuditPrompt(actor, locale, question),
    help: resolveAuditHelp(actor, locale, question),
    placeholder: resolveAuditPlaceholder(actor, locale, question),
    options: question.options?.map((option) => ({
      ...option,
      label: resolveAuditOptionLabel(actor, locale, question.id, option.value, option.label),
    })),
  };
}

export function isAdvancedAuditSection(section: DisplaySectionBase): boolean {
  return section.id.includes("advanced") || section.title.includes("Advanced / Forensic");
}
