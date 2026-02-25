// Doctor Audit Form — Surgery Submission / Case Audit
// Target: 6–8 min. Conditional FUE/FUT. Backward compat via doctorAuditSchema.

import { PROCEDURE_TYPE_FUE, PROCEDURE_TYPE_FUT } from "./doctorAuditSchema";

export type DoctorAuditAnswers = Record<string, string | number | string[] | boolean | null>;

type QuestionDef = {
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

type SectionDef = {
  id: string;
  title: string;
  questions: QuestionDef[];
  showWhen?: { questionId: string; oneOf: string[] };
};

export const DOCTOR_AUDIT_SECTIONS: SectionDef[] = [
  {
    id: "doctor_clinic",
    title: "1. Doctor & Clinic Profile",
    questions: [
      { id: "doctorName", prompt: "Doctor's Name", type: "text", placeholder: "Dr. John Smith", required: true },
      { id: "clinicName", prompt: "Clinic Name", type: "text", placeholder: "ABC Hair Clinic", required: true },
      { id: "clinicLocation", prompt: "Clinic Location", type: "text", placeholder: "City, Country", required: true },
      { id: "medicalDegree", prompt: "Medical Degree", type: "text", placeholder: "MD, Dermatology", required: true },
      {
        id: "yearsPerformingHairTransplants",
        prompt: "Years Performing Hair Transplants",
        type: "number",
        required: true,
        min: 0,
        max: 60,
        help: "0–60 years",
      },
      {
        id: "percentPracticeHairTransplant",
        prompt: "Percent of Practice Devoted to Hair Transplant",
        type: "select",
        required: true,
        options: [
          { value: "lt25", label: "<25%" },
          { value: "25_50", label: "25–50%" },
          { value: "50_75", label: "50–75%" },
          { value: "75_100", label: "75–100%" },
        ],
      },
      {
        id: "memberships",
        prompt: "Memberships",
        type: "checkbox",
        options: [
          { value: "ishrs", label: "ISHRS" },
          { value: "abhrs", label: "ABHRS" },
          { value: "national_board", label: "National Board" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "otherMembershipText",
        prompt: "Other membership (please specify)",
        type: "text",
        dependsOn: { questionId: "memberships", hasValue: "other" },
      },
    ],
  },
  {
    id: "patient_profile",
    title: "2. Patient Profile (De-identified)",
    questions: [
      { id: "patientAge", prompt: "Patient Age", type: "number", required: true, min: 10, max: 100 },
      {
        id: "patientGender",
        prompt: "Patient Gender",
        type: "select",
        required: true,
        options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "hairLossClassification",
        prompt: "Hair Loss Classification",
        type: "select",
        required: true,
        options: [
          { value: "norwood_1", label: "Norwood 1" },
          { value: "norwood_2", label: "Norwood 2" },
          { value: "norwood_3", label: "Norwood 3" },
          { value: "norwood_4", label: "Norwood 4" },
          { value: "norwood_5", label: "Norwood 5" },
          { value: "norwood_6", label: "Norwood 6" },
          { value: "norwood_7", label: "Norwood 7" },
          { value: "ludwig_1", label: "Ludwig 1" },
          { value: "ludwig_2", label: "Ludwig 2" },
          { value: "ludwig_3", label: "Ludwig 3" },
          { value: "diffuse", label: "Diffuse" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "hairLossOtherText",
        prompt: "Hair loss classification (if Other)",
        type: "text",
        dependsOn: { questionId: "hairLossClassification", value: "other" },
      },
      {
        id: "donorDensityMeasuredPreOp",
        prompt: "Donor Density Measured Pre-Op",
        type: "select",
        required: true,
        options: [
          { value: "yes_trichoscopy", label: "Yes (Trichoscopy)" },
          { value: "yes_visual", label: "Yes (Visual)" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "preOpDensityFuPerCm2",
        prompt: "Pre-Op Density (FU/cm²)",
        type: "number",
        min: 0,
        max: 200,
        help: "Optional, 0–200",
      },
    ],
  },
  {
    id: "procedure_overview",
    title: "3. Procedure Overview",
    questions: [
      {
        id: "procedureType",
        prompt: "Procedure Type",
        type: "select",
        required: true,
        options: [
          { value: "fue_manual", label: "FUE (Manual)" },
          { value: "fue_motorized", label: "FUE (Motorized)" },
          { value: "fue_robotic", label: "FUE (Robotic)" },
          { value: "fut", label: "FUT" },
          { value: "combined", label: "Combined FUT + FUE" },
        ],
      },
      {
        id: "totalGraftsExtracted",
        prompt: "Total Grafts Extracted",
        type: "number",
        required: true,
        min: 1,
        max: 10000,
      },
      {
        id: "totalGraftsImplanted",
        prompt: "Total Grafts Implanted",
        type: "number",
        required: true,
        min: 1,
        max: 10000,
      },
      {
        id: "extractionPerformedBy",
        prompt: "Extraction Performed By",
        type: "select",
        required: true,
        options: [
          { value: "doctor", label: "Doctor" },
          { value: "nurse", label: "Nurse" },
          { value: "technician", label: "Technician" },
          { value: "mixed", label: "Mixed" },
        ],
      },
      {
        id: "implantationPerformedBy",
        prompt: "Implantation Performed By",
        type: "select",
        required: true,
        options: [
          { value: "doctor", label: "Doctor" },
          { value: "nurse", label: "Nurse" },
          { value: "technician", label: "Technician" },
          { value: "mixed", label: "Mixed" },
        ],
      },
    ],
  },
  {
    id: "fue_details",
    title: "4. Donor Extraction Details (FUE Only)",
    showWhen: { questionId: "procedureType", oneOf: [...PROCEDURE_TYPE_FUE] },
    questions: [
      {
        id: "fuePunchType",
        prompt: "FUE Punch Type",
        type: "select",
        required: true,
        options: [
          { value: "sharp", label: "Sharp" },
          { value: "dull", label: "Dull" },
          { value: "hybrid", label: "Hybrid" },
          { value: "trumpet", label: "Trumpet" },
          { value: "serrated", label: "Serrated" },
        ],
      },
      {
        id: "fuePunchDiameterRangeMm",
        prompt: "Punch Diameter Range (mm)",
        type: "select",
        required: true,
        options: [
          { value: "lt08", label: "<0.8" },
          { value: "08_09", label: "0.8–0.9" },
          { value: "09_10", label: "0.9–1.0" },
          { value: "gt10", label: ">1.0" },
        ],
      },
      {
        id: "fuePunchMovement",
        prompt: "Punch Movement",
        type: "select",
        required: true,
        options: [
          { value: "full_rotation", label: "Full rotation" },
          { value: "oscillation", label: "Oscillation" },
          { value: "hybrid", label: "Hybrid" },
        ],
      },
      {
        id: "fueDepthControl",
        prompt: "Depth Control",
        type: "select",
        required: true,
        options: [
          { value: "visual_only", label: "Visual only" },
          { value: "guarded", label: "Guarded" },
          { value: "digital", label: "Digital" },
        ],
      },
      {
        id: "fueDocumentedTransectionRatePercent",
        prompt: "Documented Transection Rate (%)",
        type: "number",
        min: 0,
        max: 100,
        help: "Optional",
      },
    ],
  },
  {
    id: "fut_details",
    title: "5. FUT Details (FUT Only)",
    showWhen: { questionId: "procedureType", oneOf: [...PROCEDURE_TYPE_FUT] },
    questions: [
      {
        id: "futBladeType",
        prompt: "Blade Type",
        type: "select",
        required: true,
        options: [
          { value: "single", label: "Single" },
          { value: "double", label: "Double" },
          { value: "parallel", label: "Parallel" },
        ],
      },
      {
        id: "futClosureTechnique",
        prompt: "Closure Technique",
        type: "select",
        required: true,
        options: [
          { value: "standard_layered", label: "Standard layered" },
          { value: "trichophytic", label: "Trichophytic" },
          { value: "staples", label: "Staples" },
        ],
      },
      {
        id: "futMicroscopicDissectionUsed",
        prompt: "Microscopic Dissection Used",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    id: "graft_handling",
    title: "6. Graft Handling & Preservation",
    questions: [
      {
        id: "holdingSolution",
        prompt: "Holding Solution",
        type: "select",
        required: true,
        help: "Critical for graft survival.",
        options: [
          { value: "saline", label: "Saline" },
          { value: "hypothermic", label: "Hypothermic solution" },
          { value: "atp_enhanced", label: "ATP-enhanced" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "holdingSolutionOtherText",
        prompt: "Holding solution (if Other)",
        type: "text",
        dependsOn: { questionId: "holdingSolution", value: "other" },
      },
      {
        id: "temperatureControlled",
        prompt: "Temperature Controlled",
        type: "select",
        required: true,
        options: [
          { value: "ice_bowl", label: "Ice bowl" },
          { value: "measured_digital", label: "Measured digital" },
          { value: "no_control", label: "No control" },
        ],
      },
      {
        id: "outOfBodyTimeLogged",
        prompt: "Out-of-Body Time Logged",
        type: "select",
        required: true,
        help: "OBT logging indicates protocol quality.",
        options: [
          { value: "no", label: "No" },
          { value: "estimated", label: "Estimated" },
          { value: "digitally_logged", label: "Digitally logged" },
        ],
      },
      {
        id: "avgOutOfBodyTimeHours",
        prompt: "Avg Out-of-Body Time (hours)",
        type: "number",
        min: 0,
        max: 24,
      },
      {
        id: "microscopeStationsUsed",
        prompt: "Microscope Stations Used",
        type: "select",
        required: true,
        options: [
          { value: "0", label: "0" },
          { value: "1_2", label: "1–2" },
          { value: "3_4", label: "3–4" },
          { value: "5_plus", label: "5+" },
        ],
      },
      {
        id: "microscopeType",
        prompt: "Microscope Type",
        type: "select",
        options: [
          { value: "basic_stereo", label: "Basic stereo" },
          { value: "high_end_stereo", label: "High-end stereo" },
        ],
      },
    ],
  },
  {
    id: "recipient_implantation",
    title: "7. Recipient Site & Implantation",
    questions: [
      {
        id: "recipientTool",
        prompt: "Recipient Tool",
        type: "select",
        required: true,
        options: [
          { value: "steel_blade", label: "Steel blade" },
          { value: "sapphire_blade", label: "Sapphire blade" },
          { value: "needle", label: "Needle" },
          { value: "implanter_pen", label: "Implanter pen" },
          { value: "mixed", label: "Mixed" },
        ],
      },
      {
        id: "implantationMethod",
        prompt: "Implantation Method",
        type: "select",
        required: true,
        options: [
          { value: "forceps", label: "Forceps" },
          { value: "premade_slits_forceps", label: "Pre-made slits + forceps" },
          { value: "implanter", label: "Implanter" },
        ],
      },
      {
        id: "densePackingAttempted",
        prompt: "Dense Packing Attempted",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "implanterType",
        prompt: "Implanter Type",
        type: "select",
        required: true,
        dependsOn: {
          or: [
            { questionId: "recipientTool", value: "implanter_pen" },
            { questionId: "implantationMethod", value: "implanter" },
          ],
        },
        options: [
          { value: "choi", label: "Choi" },
          { value: "lion", label: "Lion" },
          { value: "keep", label: "KEEP" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "implanterOtherText",
        prompt: "Implanter type (if Other)",
        type: "text",
        dependsOn: { questionId: "implanterType", value: "other" },
      },
    ],
  },
  {
    id: "donor_management",
    title: "8. Donor Management",
    questions: [
      {
        id: "donorMappingMethod",
        prompt: "Donor Mapping Method",
        type: "select",
        required: true,
        options: [
          { value: "visual_only", label: "Visual only" },
          { value: "measured_zones", label: "Measured zones" },
          { value: "density_mapped_grid", label: "Density-mapped grid" },
        ],
      },
      {
        id: "percentExtractionPerZoneControlled",
        prompt: "Percent Extraction Per Zone Controlled",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "postOpDonorDensityMeasured",
        prompt: "Post-Op Donor Density Measured",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    id: "sterility_safety",
    title: "9. Sterility & Safety",
    questions: [
      {
        id: "sterilizationProtocol",
        prompt: "Sterilization Protocol",
        type: "checkbox",
        required: true,
        options: [
          { value: "autoclave", label: "Autoclave" },
          { value: "single_use", label: "Single-use disposables" },
          { value: "chemical", label: "Chemical" },
          { value: "mixed", label: "Mixed" },
        ],
      },
      {
        id: "graftCountDoubleVerified",
        prompt: "Graft Count Double Verified",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "intraOpComplications",
        prompt: "Intra-Op Complications",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "bleeding", label: "Bleeding" },
          { value: "popping", label: "Popping" },
          { value: "desiccation", label: "Desiccation" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "complicationsOtherText",
        prompt: "Complications (if Other)",
        type: "text",
        dependsOn: { questionId: "intraOpComplications", value: "other" },
      },
    ],
  },
  {
    id: "cost",
    title: "10. Cost & Value Transparency",
    questions: [
      {
        id: "totalProcedureCostUsd",
        prompt: "Total Procedure Cost (USD equivalent)",
        type: "number",
        required: true,
        min: 0,
        max: 500000,
        help: "Store in USD. Currency conversion if needed.",
      },
      {
        id: "costModel",
        prompt: "Cost Model",
        type: "select",
        required: true,
        options: [
          { value: "per_graft", label: "Per graft" },
          { value: "per_session", label: "Per session" },
          { value: "package", label: "Package" },
        ],
      },
      {
        id: "includedInCost",
        prompt: "Included in Cost",
        type: "checkbox",
        options: [
          { value: "prp", label: "PRP" },
          { value: "medications", label: "Medications" },
          { value: "follow_up", label: "Follow-up" },
          { value: "facility", label: "Facility" },
          { value: "anaesthesia", label: "Anaesthesia" },
        ],
      },
    ],
  },
  {
    id: "postop_protocol",
    title: "11. Post-Operative Protocol",
    questions: [
      {
        id: "dhtManagementRecommended",
        prompt: "DHT Management Recommended",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "prpPostOpUsed",
        prompt: "PRP Post-Op Used",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "followUpScheduleStandardized",
        prompt: "Follow-Up Schedule Standardized",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "photoDocumentationRequired12Month",
        prompt: "Photo Documentation Required (12 month)",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    id: "self_assessment",
    title: "12. Doctor Self-Assessment",
    questions: [
      {
        id: "estimatedGraftSurvivalPercent",
        prompt: "Estimated Graft Survival (%)",
        type: "number",
        min: 0,
        max: 100,
        help: "Optional",
      },
      {
        id: "overallCaseSuccessRating",
        prompt: "Overall Case Success",
        type: "rating",
        min: 1,
        max: 5,
        required: true,
        help: "1–5 stars",
      },
      {
        id: "notesOptional",
        prompt: "Additional Notes",
        type: "textarea",
        placeholder: "Optional comments",
      },
    ],
  },
];
