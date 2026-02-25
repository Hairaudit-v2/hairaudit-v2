// Doctor Audit Form schema — validation + backward compat mapping
// Target: 6–8 min completion, conditional FUE/FUT sections

import { z } from "zod";

// Procedure types for conditional logic
export const PROCEDURE_TYPE_FUE = ["fue_manual", "fue_motorized", "fue_robotic", "combined"] as const;
export const PROCEDURE_TYPE_FUT = ["fut", "combined"] as const;

export const doctorAuditSchema = z
  .object({
    // Section 1: Doctor & Clinic Profile
    doctorName: z.string().min(1, "Required"),
    clinicName: z.string().min(1, "Required"),
    clinicLocation: z.string().min(1, "Required"),
    medicalDegree: z.string().min(1, "Required"),
    yearsPerformingHairTransplants: z.coerce.number().min(0).max(60),
    percentPracticeHairTransplant: z.enum(["lt25", "25_50", "50_75", "75_100"]),
    memberships: z.array(z.string()).optional(),
    otherMembershipText: z.string().optional(),

    // Section 2: Patient Profile
    patientAge: z.coerce.number().min(10).max(100),
    patientGender: z.enum(["male", "female", "other"]),
    hairLossClassification: z.enum([
      "norwood_1", "norwood_2", "norwood_3", "norwood_4", "norwood_5", "norwood_6", "norwood_7",
      "ludwig_1", "ludwig_2", "ludwig_3", "diffuse", "other"
    ]),
    hairLossOtherText: z.string().optional(),
    donorDensityMeasuredPreOp: z.enum(["yes_trichoscopy", "yes_visual", "no"]),
    preOpDensityFuPerCm2: z.number().min(0).max(200).optional(),

    // Section 3: Procedure Overview
    procedureType: z.enum(["fue_manual", "fue_motorized", "fue_robotic", "fut", "combined"]),
    totalGraftsExtracted: z.coerce.number().min(1).max(10000),
    totalGraftsImplanted: z.coerce.number().min(1).max(10000),
    extractionPerformedBy: z.enum(["doctor", "nurse", "technician", "mixed"]),
    implantationPerformedBy: z.enum(["doctor", "nurse", "technician", "mixed"]),

    // Section 4: FUE (required if FUE)
    fuePunchType: z.string().optional(),
    fuePunchDiameterRangeMm: z.string().optional(),
    fuePunchMovement: z.string().optional(),
    fueDepthControl: z.string().optional(),
    fueDocumentedTransectionRatePercent: z.number().min(0).max(100).optional(),

    // Section 5: FUT (required if FUT)
    futBladeType: z.string().optional(),
    futClosureTechnique: z.string().optional(),
    futMicroscopicDissectionUsed: z.string().optional(),

    // Section 6: Graft Handling
    holdingSolution: z.enum(["saline", "hypothermic", "atp_enhanced", "other"]),
    holdingSolutionOtherText: z.string().optional(),
    temperatureControlled: z.enum(["ice_bowl", "measured_digital", "no_control"]),
    outOfBodyTimeLogged: z.enum(["no", "estimated", "digitally_logged"]),
    avgOutOfBodyTimeHours: z.number().min(0).max(24).optional(),
    microscopeStationsUsed: z.enum(["0", "1_2", "3_4", "5_plus"]),
    microscopeType: z.enum(["basic_stereo", "high_end_stereo"]).optional(),

    // Section 7: Recipient Site & Implantation
    recipientTool: z.enum(["steel_blade", "sapphire_blade", "needle", "implanter_pen", "mixed"]),
    implantationMethod: z.enum(["forceps", "premade_slits_forceps", "implanter"]),
    densePackingAttempted: z.enum(["yes", "no"]),
    implanterType: z.string().optional(),
    implanterOtherText: z.string().optional(),

    // Section 8: Donor Management
    donorMappingMethod: z.enum(["visual_only", "measured_zones", "density_mapped_grid"]),
    percentExtractionPerZoneControlled: z.enum(["yes", "no"]),
    postOpDonorDensityMeasured: z.enum(["yes", "no"]).optional(),

    // Section 9: Sterility & Safety
    sterilizationProtocol: z.array(z.string()).min(1, "At least one sterilization method required"),
    graftCountDoubleVerified: z.enum(["yes", "no"]),
    intraOpComplications: z.string().optional(),
    complicationsOtherText: z.string().optional(),

    // Section 10: Cost
    totalProcedureCostUsd: z.coerce.number().min(0).max(500000),
    costModel: z.enum(["per_graft", "per_session", "package"]),
    includedInCost: z.array(z.string()).optional(),

    // Section 11: Post-Op Protocol
    dhtManagementRecommended: z.enum(["yes", "no"]),
    prpPostOpUsed: z.enum(["yes", "no"]),
    followUpScheduleStandardized: z.enum(["yes", "no"]),
    photoDocumentationRequired12Month: z.enum(["yes", "no"]),

    // Section 12: Doctor Self-Assessment
    estimatedGraftSurvivalPercent: z.number().min(0).max(100).optional(),
    overallCaseSuccessRating: z.coerce.number().min(1).max(5),
    notesOptional: z.string().optional(),
  })
  .refine(
    (d) => {
      const pt = d.procedureType;
      const isFue = PROCEDURE_TYPE_FUE.includes(pt as (typeof PROCEDURE_TYPE_FUE)[number]);
      const isFut = PROCEDURE_TYPE_FUT.includes(pt as (typeof PROCEDURE_TYPE_FUT)[number]);
      if (isFue && (!d.fuePunchType || !d.fuePunchDiameterRangeMm || !d.fuePunchMovement || !d.fueDepthControl))
        return false;
      if (isFut && (!d.futBladeType || !d.futClosureTechnique || !d.futMicroscopicDissectionUsed)) return false;
      return true;
    },
    { message: "FUE/FUT-specific fields are required based on procedure type" }
  )
  .refine(
    (d) => {
      const needsImplanter =
        d.recipientTool === "implanter_pen" || d.implantationMethod === "implanter";
      if (needsImplanter && !d.implanterType) return false;
      return true;
    },
    { message: "Implanter type is required when using implanter pen or implanter method" }
  )
  .refine(
    (d) => {
      if (d.holdingSolution === "other" && !d.holdingSolutionOtherText) return false;
      return true;
    },
    { message: "Please specify holding solution when Other is selected" }
  );

export type DoctorAuditFormData = z.infer<typeof doctorAuditSchema>;

/** Validate doctor answers; returns first error message or null if valid */
export function validateDoctorAnswers(data: Record<string, unknown>): string | null {
  const parsed = doctorAuditSchema.safeParse(data);
  if (parsed.success) return null;
  const issues = (parsed as { error: { issues?: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? [];
  const first = issues[0];
  const path = first?.path ? String((first.path as string[]).join(".")) : "";
  return first ? (path ? `${path}: ${first.message}` : first.message) : "Validation failed";
}

/** Map legacy doctor_answers keys to new schema keys for backward compatibility */
export function mapLegacyDoctorAnswers(legacy: Record<string, unknown> | null): Record<string, unknown> {
  if (!legacy || typeof legacy !== "object") return {};
  const m: Record<string, unknown> = {};
  const map: Record<string, string> = {
    doctor_name: "doctorName",
    practice_name: "clinicName",
    practice_location: "clinicLocation",
    medical_degree: "medicalDegree",
    years_experience: "yearsPerformingHairTransplants",
    patient_age: "patientAge",
    patient_gender: "patientGender",
    hair_loss_pattern: "hairLossClassification",
    medical_history: "notesOptional",
    technique: "procedureType",
    grafts_extracted: "totalGraftsExtracted",
    grafts_implanted: "totalGraftsImplanted",
    extraction_performed_by: "extractionPerformedBy",
    preparation_performed_by: "notesOptional", // merge into notes
    implantation_performed_by: "implantationPerformedBy",
    total_cost: "totalProcedureCostUsd",
    cost_inclusions: "includedInCost",
    success_rating: "overallCaseSuccessRating",
    additional_comments: "notesOptional",
  };
  const techniqueMap: Record<string, string> = {
    fue: "fue_manual",
    fut: "fut",
    dhi: "fue_motorized",
    robotic: "fue_robotic",
  };
  const notesParts: string[] = [];
  for (const [oldKey, val] of Object.entries(legacy)) {
    if (val === null || val === undefined) continue;
    if (oldKey === "preparation_performed_by" || oldKey === "additional_comments") {
      if (typeof val === "string" && val.trim()) notesParts.push(val);
      continue;
    }
    const newKey = map[oldKey] ?? oldKey;
    let v = val;
    if (oldKey === "technique" && typeof val === "string") v = techniqueMap[val] ?? val;
    if (oldKey === "extraction_performed_by" || oldKey === "implantation_performed_by") {
      const s = String(val).toLowerCase();
      if (s.includes("doctor") && !s.includes("nurse") && !s.includes("technician")) v = "doctor";
      else if (s.includes("nurse") && !s.includes("technician")) v = "nurse";
      else if (s.includes("technician") && !s.includes("nurse")) v = "technician";
      else v = "mixed";
    }
    if (oldKey === "total_cost" && typeof val === "string") {
      const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
      v = Number.isFinite(num) ? num : val;
    }
    if (oldKey === "hair_loss_pattern" && typeof val === "string") {
      const hlMap: Record<string, string> = {
        norwood_1: "norwood_1", norwood_2: "norwood_2", norwood_3: "norwood_3",
        norwood_4: "norwood_4", norwood_5: "norwood_5", norwood_6: "norwood_6",
        ludwig_1: "ludwig_1", ludwig_2: "ludwig_2", ludwig_3: "ludwig_3",
        diffuse: "diffuse", other: "other",
      };
      v = hlMap[val] ?? val;
    }
    if (oldKey === "cost_inclusions" && Array.isArray(val)) {
      const incMap: Record<string, string> = {
        consultation: "consultation", prp: "prp", procedure: "procedure",
        anesthesia: "anaesthesia", facility: "facility", postop_care: "follow_up",
        medications: "medications", other: "other",
      };
      v = val.map((x) => incMap[String(x)] ?? x);
    }
    m[newKey] = v;
  }
  if (notesParts.length) m.notesOptional = notesParts.join("\n\n");
  return m;
}
