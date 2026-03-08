/**
 * Flattens nested intake data so dot-path keys resolve correctly.
 * Use when reading values for summary display to avoid nested object fragmentation.
 * - Top-level keys (clinic_name, procedure_type, etc.) stay as-is
 * - Nested objects (enhanced_patient_answers.baseline, .hair_biology, etc.) are flattened
 *   so "enhanced_patient_answers.baseline.patient_age" exists as a flat key
 */
export function normalizeIntake(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};

  const result: Record<string, unknown> = { ...data };

  function flattenInto(obj: unknown, prefix: string) {
    if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v)) {
        flattenInto(v, path);
      } else {
        result[path] = v;
      }
    }
  }

  const epa = data.enhanced_patient_answers;
  if (epa && typeof epa === "object" && !Array.isArray(epa)) {
    flattenInto(epa, "enhanced_patient_answers");
  }

  // Also spread common nested shapes for backward compatibility (legacy keys)
  const adv = data.advanced as Record<string, unknown> | undefined;
  if (adv && typeof adv === "object" && !Array.isArray(adv)) {
    Object.assign(result, adv);
  }
  const proc = data.procedure as Record<string, unknown> | undefined;
  if (proc && typeof proc === "object" && !Array.isArray(proc)) {
    Object.assign(result, proc);
  }
  const heal = data.healing as Record<string, unknown> | undefined;
  if (heal && typeof heal === "object" && !Array.isArray(heal)) {
    Object.assign(result, heal);
  }

  return result;
}
