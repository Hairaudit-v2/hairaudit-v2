"use client";

import SearchableSelect from "./SearchableSelect";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { useI18n } from "@/components/i18n/I18nProvider";

/** Option count above which we use searchable UX (single select). */
const SEARCHABLE_SELECT_THRESHOLD = 10;
/** Option count above which we use searchable UX (multi-select). */
const SEARCHABLE_MULTI_THRESHOLD = 8;

type FormQuestion = {
  id: string;
  prompt: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  dependsOn?:
    | { questionId: string; value?: string; hasValue?: string }
    | { questionId: string; oneOf: string[] }
    | { or: Array<{ questionId: string; value: string }> };
};

export default function QuestionField({
  question,
  value,
  onChange,
  allAnswers,
  locked,
  readOnly = false,
}: {
  question: FormQuestion;
  value: unknown;
  onChange: (v: string | number | string[] | boolean | null) => void;
  allAnswers: Record<string, unknown>;
  locked: boolean;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const dep = question.dependsOn;
  let show = true;
  if (dep) {
    if ("oneOf" in dep) {
      const val = allAnswers[dep.questionId];
      show = dep.oneOf.includes(String(val ?? ""));
    } else if ("or" in dep) {
      show = dep.or.some((o) => allAnswers[o.questionId] === o.value);
    } else {
      show =
        (dep.value !== undefined && allAnswers[dep.questionId] === dep.value) ||
        (dep.hasValue !== undefined &&
          Array.isArray(allAnswers[dep.questionId]) &&
          (allAnswers[dep.questionId] as string[]).includes(dep.hasValue));
    }
  }
  if (!show) return null;

  const fieldId = `audit-${question.id}`;
  const isDisabled = locked || readOnly;
  const baseClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 disabled:bg-gray-100";
  const opts = question.options ?? [];
  const primaryControlId = question.type === "checkbox" ? `${fieldId}-${opts[0]?.value ?? "0"}` : fieldId;

  const render = () => {
    switch (question.type) {
      case "text":
        return (
          <input
            id={fieldId}
            name={question.id}
            type="text"
            className={baseClass}
            placeholder={question.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isDisabled}
            autoComplete="off"
          />
        );
      case "textarea":
        return (
          <textarea
            id={fieldId}
            name={question.id}
            className={`${baseClass} min-h-[80px]`}
            placeholder={question.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isDisabled}
          />
        );
      case "number":
        return (
          <input
            id={fieldId}
            name={question.id}
            type="number"
            className={baseClass}
            value={(value as number) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") onChange(null);
              else onChange(Number(v));
            }}
            disabled={isDisabled}
          />
        );
      case "date":
        return (
          <input
            id={fieldId}
            name={question.id}
            type="date"
            className={baseClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isDisabled}
          />
        );
      case "rating": {
        const min = question.min ?? 1;
        const max = question.max ?? 5;
        const num = typeof value === "number" ? value : value ? Number(value) : null;
        return (
          <div role="group" aria-labelledby={`${fieldId}-label`} className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                type="button"
                id={n === min ? fieldId : undefined}
                name={question.id}
                disabled={isDisabled}
                onClick={() => onChange(n)}
                className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  num === n ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      }
      case "select": {
        const useSearchable = opts.length >= SEARCHABLE_SELECT_THRESHOLD;
        if (useSearchable) {
          return (
            <SearchableSelect
              id={fieldId}
              name={question.id}
              options={opts}
              value={(value as string) ?? null}
              onChange={(v) => onChange(v)}
              disabled={isDisabled}
              placeholder={t("dashboard.shared.auditForms.selectPlaceholder")}
              className={baseClass}
            />
          );
        }
        return (
          <select
            id={fieldId}
            name={question.id}
            className={baseClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={isDisabled}
          >
            <option value="">{t("dashboard.shared.auditForms.selectPlaceholder")}</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      }
      case "yesno":
        return (
          <div role="radiogroup" aria-labelledby={`${fieldId}-label`} className="flex gap-4">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} htmlFor={v === "yes" ? fieldId : `${fieldId}-${v}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={v === "yes" ? fieldId : `${fieldId}-${v}`}
                  name={question.id}
                  value={v}
                  checked={(value as string) === v}
                  onChange={() => onChange(v)}
                  disabled={isDisabled}
                  className="rounded-full"
                />
                <span className="text-sm">{v === "yes" ? t("forms.shared.yes") : t("forms.shared.no")}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox": {
        const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
        const useSearchable = opts.length >= SEARCHABLE_MULTI_THRESHOLD;
        if (useSearchable) {
          return (
            <SearchableMultiSelect
              id={fieldId}
              name={question.id}
              options={opts}
              value={selected}
              onChange={(next) => onChange(next.length ? next : null)}
              disabled={isDisabled}
              placeholder={t("dashboard.shared.auditForms.searchMultiPlaceholder")}
              className={baseClass}
            />
          );
        }
        return (
          <div role="group" aria-labelledby={`${fieldId}-label`} className="space-y-2">
            {opts.map((o) => (
              <label key={o.value} htmlFor={`${fieldId}-${o.value}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id={`${fieldId}-${o.value}`}
                  name={question.id}
                  value={o.value}
                  checked={selected.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...selected, o.value] : selected.filter((x) => x !== o.value);
                    onChange(next.length ? next : null);
                  }}
                  disabled={isDisabled}
                  className="rounded"
                />
                <span className="text-sm">{o.label}</span>
              </label>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      <label id={`${fieldId}-label`} htmlFor={primaryControlId} className="block text-sm font-medium text-gray-700 mb-1">
        {question.prompt}
        {question.required && <span className="text-amber-600 ml-1">*</span>}
      </label>
      {readOnly && !locked && (
        <p className="text-xs text-slate-500 mb-2">{t("dashboard.shared.auditForms.inheritedFieldMessage")}</p>
      )}
      {question.help && <p className="text-xs text-gray-500 mb-2">{question.help}</p>}
      {render()}
    </div>
  );
}
