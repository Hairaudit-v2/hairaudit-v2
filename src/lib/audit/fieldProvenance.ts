export const FIELD_PROVENANCE_VALUES = [
  "entered_manually",
  "prefilled_from_doctor_default",
  "prefilled_from_clinic_default",
  "inherited_from_original_case",
  "edited_after_prefill",
  "confirmed_by_submitter",
] as const;

export type FieldProvenanceValue = (typeof FIELD_PROVENANCE_VALUES)[number];

export type FieldProvenanceMap = Record<string, FieldProvenanceValue>;

const ALLOWED = new Set<string>(FIELD_PROVENANCE_VALUES);

function toComparable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return JSON.stringify(value ?? null);
}

export function sanitizeFieldProvenance(input: unknown): FieldProvenanceMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: FieldProvenanceMap = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const candidate = String(v ?? "").trim();
    if (ALLOWED.has(candidate)) out[k] = candidate as FieldProvenanceValue;
  }
  return out;
}

export function mergeFieldProvenance(params: {
  previousAnswers: Record<string, unknown>;
  incomingAnswers: Record<string, unknown>;
  previousProvenance?: unknown;
  incomingProvenance?: unknown;
}): FieldProvenanceMap {
  const prevProv = sanitizeFieldProvenance(params.previousProvenance);
  const inProv = sanitizeFieldProvenance(params.incomingProvenance);
  const merged: FieldProvenanceMap = { ...prevProv };

  for (const [key, nextVal] of Object.entries(params.incomingAnswers)) {
    if (key === "field_provenance") continue;
    const prevVal = params.previousAnswers[key];
    const changed = toComparable(prevVal) !== toComparable(nextVal);
    const nextProv = inProv[key];
    const prevEntry = prevProv[key];
    if (!changed) {
      if (nextProv) merged[key] = nextProv;
      continue;
    }
    if (nextProv) {
      merged[key] = nextProv;
      continue;
    }
    if (
      prevEntry === "prefilled_from_doctor_default" ||
      prevEntry === "prefilled_from_clinic_default" ||
      prevEntry === "inherited_from_original_case"
    ) {
      merged[key] = "edited_after_prefill";
      continue;
    }
    merged[key] = "entered_manually";
  }

  return merged;
}
