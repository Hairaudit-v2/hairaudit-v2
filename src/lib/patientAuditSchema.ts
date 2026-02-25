// Patient Audit Form v2 — Zod validation + backward compat
// Optimized for patients who may not know technical details

import { z } from "zod";

const COUNTRY_OPTIONS = [
  "turkey", "spain", "india", "thailand", "mexico", "brazil", "argentina",
  "colombia", "australia", "uk", "usa", "canada", "uae", "belgium", "germany",
  "poland", "greece", "other"
] as const;

const PROCEDURE_TYPE_OPTIONS = ["fue", "fut", "dhi", "robotic", "not_sure", "other"] as const;
const YES_NO_NOT_SURE = ["yes", "no", "not_sure"] as const;
const CURRENCY_OPTIONS = ["usd", "eur", "gbp", "try", "inr", "thb", "mxn", "aud", "other"] as const;
const COST_MODEL_OPTIONS = ["per_graft", "per_session", "package", "not_clear"] as const;
const DONOR_SHAVING_OPTIONS = ["full_shave", "partial_shave", "no"] as const;
const SURGERY_DURATION_OPTIONS = ["under_4h", "4_6h", "6_8h", "8_plus"] as const;
const SWELLING_OPTIONS = ["none", "mild", "moderate", "severe"] as const;
const RECOVERY_TIME_OPTIONS = ["under_1_week", "1_2_weeks", "2_4_weeks", "4_plus_weeks"] as const;
const MONTHS_SINCE_OPTIONS = ["under_3", "3_6", "6_9", "9_12", "12_plus"] as const;
const WOULD_REPEAT_OPTIONS = ["yes", "no", "not_sure"] as const;

export const patientAuditSchema = z
  .object({
    // Section 1: Clinic & Procedure Details
    clinic_name: z.string().min(1, "Clinic name is required"),
    clinic_country: z.enum(COUNTRY_OPTIONS),
    clinic_country_other: z.string().optional(),
    clinic_city: z.string().min(1, "Clinic city is required"),
    procedure_date: z.string().min(1, "Procedure date is required"),
    procedure_type: z.enum(PROCEDURE_TYPE_OPTIONS),
    procedure_type_other: z.string().optional(),
    surgeon_name: z.string().optional(),
    patient_name: z.string().optional(),

    // Section 2: Transparency & Process Indicators
    preop_consult: z.enum(["yes", "no"]),
    doctor_present_extraction: z.enum(YES_NO_NOT_SURE),
    doctor_present_implant: z.enum(YES_NO_NOT_SURE),
    graft_number_disclosed: z.enum(["yes", "no"]),
    graft_number_received: z.coerce.number().min(0).max(20000).optional(),
    donor_shaving: z.enum(DONOR_SHAVING_OPTIONS),
    surgery_duration: z.enum(SURGERY_DURATION_OPTIONS),

    // Section 3: Cost & Value Transparency
    total_paid_currency: z.enum(CURRENCY_OPTIONS),
    total_paid_currency_other: z.string().optional(),
    total_paid_amount: z.coerce.number().min(0).max(500000),
    cost_model: z.enum(COST_MODEL_OPTIONS),
    what_included: z.array(z.string()).optional(),
    what_included_other: z.string().optional(),

    // Section 4: Surgical Experience
    pain_level: z.coerce.number().min(1).max(10),
    post_op_swelling: z.enum(SWELLING_OPTIONS),
    bleeding_issue: z.enum(YES_NO_NOT_SURE),

    // Section 5: Recovery & Complications
    recovery_time: z.enum(RECOVERY_TIME_OPTIONS),
    shock_loss: z.enum(YES_NO_NOT_SURE),
    complications: z.enum(["yes", "no"]),
    complications_details: z.string().optional(),

    // Section 6: Results
    months_since: z.enum(MONTHS_SINCE_OPTIONS),
    density_satisfaction: z.coerce.number().min(1).max(5),
    hairline_naturalness: z.coerce.number().min(1).max(5),
    donor_appearance: z.coerce.number().min(1).max(5),
    would_repeat: z.enum(WOULD_REPEAT_OPTIONS),
    would_recommend: z.enum(["yes", "no"]),
  })
  .refine(
    (d) => d.clinic_country !== "other" || (d.clinic_country_other?.trim?.() ?? "").length > 0,
    { message: "Please specify clinic country when Other is selected", path: ["clinic_country_other"] }
  )
  .refine(
    (d) => d.procedure_type !== "other" || (d.procedure_type_other?.trim?.() ?? "").length > 0,
    { message: "Please specify procedure type when Other is selected", path: ["procedure_type_other"] }
  )
  .refine(
    (d) => d.total_paid_currency !== "other" || (d.total_paid_currency_other?.trim?.() ?? "").length > 0,
    { message: "Please specify currency when Other is selected", path: ["total_paid_currency_other"] }
  )
  .refine(
    (d) => {
      const arr = d.what_included ?? [];
      if (!arr.includes("other")) return true;
      return (d.what_included_other?.trim?.() ?? "").length > 0;
    },
    { message: "Please specify what was included when Other is selected", path: ["what_included_other"] }
  )
  .refine(
    (d) => d.complications !== "yes" || (d.complications_details?.trim?.() ?? "").length > 0,
    { message: "Please provide complication details when Yes is selected", path: ["complications_details"] }
  );

export type PatientAuditV2 = z.infer<typeof patientAuditSchema>;

/** Validate patient v2 answers; returns first error message or null if valid */
export function validatePatientAuditV2(data: Record<string, unknown>): string | null {
  const parsed = patientAuditSchema.safeParse(data);
  if (parsed.success) return null;
  const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? [];
  const first = issues[0];
  const path = first?.path ? String((first.path as string[]).join(".")) : "";
  return first ? (path ? `${path}: ${first.message}` : first.message) : "Validation failed";
}

/** Normalize form values (strings → numbers where needed) before validation */
export function normalizePatientV2ForValidation(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  const numKeys = ["graft_number_received", "total_paid_amount", "pain_level", "density_satisfaction", "hairline_naturalness", "donor_appearance"];
  for (const k of numKeys) {
    const v = out[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/[^0-9.]/g, ""));
      out[k] = Number.isFinite(n) ? n : v;
    }
  }

  if (out.what_included && !Array.isArray(out.what_included)) {
    out.what_included = [String(out.what_included)];
  }
  return out;
}

/** Map legacy patient_answers keys to v2 keys for backward compatibility */
export function mapLegacyPatientAnswers(legacy: Record<string, unknown> | null): Record<string, unknown> {
  if (!legacy || typeof legacy !== "object") return {};
  const m: Record<string, unknown> = {};
  const countryMap: Record<string, string> = {
    turkey: "turkey", spain: "spain", india: "india", thailand: "thailand",
    mexico: "mexico", brazil: "brazil", argentina: "argentina", colombia: "colombia",
    australia: "australia", uk: "uk", usa: "usa", canada: "canada", uae: "uae",
    belgium: "belgium", germany: "germany", poland: "poland", greece: "greece", other: "other",
  };
  const procedureMap: Record<string, string> = {
    fue: "fue", fut: "fut", dhi: "dhi", robotic: "robotic", other: "other",
  };
  const recoveryMap: Record<string, string> = {
    under_1_week: "under_1_week", "1_2_weeks": "1_2_weeks",
    "2_4_weeks": "2_4_weeks", over_4_weeks: "4_plus_weeks",
  };

  m.clinic_name = legacy.clinic_name ?? "";
  m.clinic_country = countryMap[String(legacy.clinic_country ?? "").toLowerCase()] ?? "other";
  m.clinic_city = legacy.clinic_city ?? "";
  m.procedure_date = legacy.procedure_date ?? "";
  const pt = String(legacy.procedure_type ?? "").toLowerCase();
  m.procedure_type = procedureMap[pt] ?? "not_sure";
  m.surgeon_name = legacy.surgeon_name ?? "";
  m.patient_name = legacy.patient_name ?? "";

  m.total_paid_currency = legacy.total_paid_currency ?? "usd";
  const amt = legacy.total_paid_amount;
  m.total_paid_amount = typeof amt === "number" ? amt : parseFloat(String(amt ?? 0).replace(/[^0-9.]/g, "")) || 0;
  m.recovery_time = recoveryMap[String(legacy.recovery_time ?? "")] ?? "";
  m.complications = legacy.complications ?? "no";
  m.complications_details = legacy.complications_details ?? "";
  m.density_satisfaction = legacy.results_satisfaction ?? legacy.density_satisfaction ?? 0;
  m.would_recommend = legacy.would_recommend ?? "";

  return m;
}
