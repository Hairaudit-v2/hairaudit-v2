// src/lib/ai/audit.ts
// AI-powered hair transplant audit using GPT-4 Vision (images) + GPT-4 (text answers)
// Falls back to text-only if no vision capability or images unavailable.

import OpenAI from "openai";
import { maxTokensParam } from "@/lib/ai/openaiTokenCompat";

export interface PatientBaseline {
  patient_age: number;
  patient_sex: "Male" | "Female" | "Intersex" | "Prefer not to say";
  smoking_status: "No" | "Occasionally" | "Daily";
  alcohol_frequency?: "Rare" | "Weekly" | "Daily";
  diabetes?: "No" | "Type1" | "Type2" | "Not sure";
  autoimmune_conditions?: string;
  thyroid_issues?: "No" | "Yes" | "Not sure";
  clotting_disorders?: "No" | "Yes" | "Not sure";
  blood_thinners?: string;
  steroid_use?: string;
  previous_scalp_surgeries?: string;
}

export interface HairBiologyProfile {
  hair_loss_duration_years: number;
  hair_loss_progression_speed: "Slow" | "Moderate" | "Rapid";
  family_history_strength: "None" | "Mild" | "Strong" | "Unknown";
  current_medications_for_hair?: string;
  stopped_medications_recently?: boolean;
  scalp_condition_history?: string;
  previous_prp_or_exosomes?: boolean;
}

export interface DonorRiskProfile {
  pre_existing_donor_thinning: "None" | "Mild" | "Moderate" | "Severe" | "Not sure";
  donor_density_measured: "Numeric" | "Visual only" | "No" | "Not sure";
  donor_area_marked_preop: "Yes" | "No" | "Not sure";
  donor_extraction_pattern_observed?: "Uniform" | "Clustered" | "Not sure";
  multiple_days_of_extraction?: boolean;
}

export interface ProcedureExecutionDetails {
  technician_role_extraction: "Doctor" | "Technician" | "Mixed" | "Not sure";
  technician_role_implantation: "Doctor" | "Technician" | "Mixed" | "Not sure";
  grafts_claimed_total?: number;
  graft_ratio?: number;
  hairline_drawn_by_doctor?: "Yes" | "Technician" | "Not sure";
  single_hair_grafts_front?: "Yes" | "No" | "Not sure";
  crown_pattern_discussed?: "Yes" | "No" | "Not sure";
}

export interface GraftHandlingDetails {
  out_of_body_time_estimate?: "Less than 1h" | "1-2h" | "2-4h" | "4h+" | "Not sure";
  storage_solution?: "Saline" | "HypoThermosol" | "PRP" | "Other" | "Not sure";
  temperature_control?: "Chilled" | "Room temp" | "Not sure";
  grafts_kept_hydrated?: "Yes" | "No" | "Not sure";
  exposed_to_air?: "Never" | "Occasionally" | "Frequently" | "Not sure";
  long_breaks_during_surgery?: "No" | "Under 30min" | "Over 1h" | "Not sure";
}

export interface HealingCourse {
  shedding_start_week?: number;
  shedding_severity?: "None" | "Mild" | "Moderate" | "Heavy";
  regrowth_start_month?: number;
  current_month_postop?: number;
  visible_density_improvement?: "None" | "Mild" | "Moderate" | "Significant";
  uneven_growth_present?: boolean;
  persistent_redness?: boolean;
  recipient_irregularities?: "Cobblestoning" | "Pitting" | "Ridges" | "None" | "Not sure";
}

export interface AestheticInputs {
  hairline_height_changed_cm?: number;
  temple_points_reconstructed?: boolean;
  direction_matches_native?: "Yes" | "Slight mismatch" | "No" | "Not sure";
  crown_swirl_matches?: "Yes" | "No" | "Not applicable";
}

export interface PatientExperience {
  communication_rating: 1 | 2 | 3 | 4 | 5;
  transparency_rating: 1 | 2 | 3 | 4 | 5;
  felt_rushed?: boolean;
  felt_informed?: "Yes" | "Somewhat" | "No";
  legal_or_refund_dispute?: "No" | "Ongoing" | "Resolved";
  current_satisfaction: number; // 0–10
  biggest_concern_now?: string;
  considering_revision?: "Yes" | "No" | "Unsure";
}

export interface EnhancedPatientAnswers {
  baseline?: PatientBaseline;
  hair_biology?: HairBiologyProfile;
  donor_profile?: DonorRiskProfile;
  procedure_execution?: ProcedureExecutionDetails;
  graft_handling?: GraftHandlingDetails;
  healing_course?: HealingCourse;
  aesthetics?: AestheticInputs;
  experience?: PatientExperience;
}

export type AuditMode = "patient" | "full";

export type AIAuditInput = {
  patient_answers?: Record<string, unknown> | null;
  doctor_answers?: Record<string, unknown> | null;
  clinic_answers?: Record<string, unknown> | null;
  patient_baseline?: PatientBaseline | null;
  enhanced_patient_answers?: EnhancedPatientAnswers | null;
  /** Server-prepared images for vision analysis (data URI payloads are built server-side). */
  imageInputs?: Array<{
    sourceKey: string;
    mimeType: string;
    dataBase64: string;
  }>;
  /** Optional: image keys that failed server-side download/prep and were skipped. */
  failedImageKeys?: string[];
  /** Optional: total image candidates before failures, for confidence penalties. */
  requestedImageCount?: number;
  /** patient = evaluate only patient evidence; full = require doctor/clinic for benchmarking */
  auditMode?: AuditMode;
};

export type AIAuditResult = {
  overall_score: number; // 0–100 (computed from weighted section scores)
  confidence: number; // 0–1
  confidence_label: "low" | "medium" | "high";
  data_quality: {
    missing_inputs: string[];
    missing_photos: string[];
    limitations: string[];
  };
  section_scores: {
    donor_management: number;
    extraction_quality: number;
    recipient_placement: number;
    hairline_design: number;
    density_distribution: number;
    /** From answers only */
    graft_handling_and_viability: number;
    /** From answers only */
    post_op_course_and_aftercare: number;
    complications_and_risks: number;
    naturalness_and_aesthetics: number;
  };
  /**
   * Evidence supporting each section score.
   * Acceptance: every score must have 1–3 evidence items OR explicitly state "insufficient evidence".
   */
  section_score_evidence: {
    donor_management: string[];
    extraction_quality: string[];
    recipient_placement: string[];
    hairline_design: string[];
    density_distribution: string[];
    graft_handling_and_viability: string[];
    post_op_course_and_aftercare: string[];
    complications_and_risks: string[];
    naturalness_and_aesthetics: string[];
  };
  evidence_catalog?: never;
  key_findings: {
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: EvidenceItem[];
    impact: string;
    recommended_next_step: string;
  }[];
  red_flags: {
    flag: string;
    why_it_matters: string;
    evidence: EvidenceItem[];
  }[];
  photo_observations: {
    image_url: string;
    suspected_view:
      | "preop_front"
      | "preop_left"
      | "preop_right"
      | "preop_top"
      | "preop_crown"
      | "donor_rear"
      | "donor_sides"
      | "intraop_recipient"
      | "intraop_donor"
      | "postop_day0"
      | "postop_healed"
      | "unknown";
    what_can_be_assessed: string[];
    what_cannot: string[];
    observations: string[];
    confidence: number; // 0–1
  }[];
  summary: string; // 3–6 sentences
  non_medical_disclaimer: string;
  /** Model used for audit (for transparency) */
  model: string;

  /**
   * @deprecated Use `overall_score`.
   */
  score: number;
  /**
   * @deprecated Prefer `section_scores` + `key_findings`.
   */
  donor_quality: string;
  /**
   * @deprecated Prefer `section_scores.graft_handling_and_viability` + `data_quality`.
   */
  graft_survival_estimate: string;
  /**
   * @deprecated Use `summary`.
   */
  notes: string;
  /**
   * @deprecated Use `key_findings`.
   */
  findings: string[];
};

export type EvidenceItem = {
  source_type: "photo" | "patient_answer" | "doctor_answer" | "clinic_answer";
  /** Image URL/index OR answer key name */
  source_key: string;
  /** Short, objective statement (no diagnosis) */
  observation: string;
  confidence: number; // 0–1
};

type RequiredEvidenceType = "images" | "answers" | "both";

type RubricBand = {
  label: "excellent" | "good" | "fair" | "poor";
  score_range: [number, number];
  meaning: string;
};

type RubricSectionDef = {
  id: string;
  title: string;
  weight: number; // must sum to 1.0 across sections
  definition: string;
  required_evidence_types: RequiredEvidenceType[];
  bands: readonly RubricBand[];
  common_failure_patterns: readonly string[];
};

/**
 * Explainable scoring rubric for HairAudit + Follicle Intelligence.
 * The model is instructed to reference these IDs/criteria in its evidence.
 */
export const AUDIT_RUBRIC: Record<keyof AIAuditResult["section_scores"], RubricSectionDef> = {
  donor_management: {
    id: "DM",
    title: "Donor management",
    weight: 0.12,
    definition:
      "Assessment of donor-area planning and preservation: distribution/spread of extractions, avoidance of overharvesting, respect of safe donor zone, and minimizing visible scarring risk.",
    required_evidence_types: ["images"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Even spread, safe-zone respected, no patchiness/moth-eaten patterns, low scarring risk." },
      { label: "good", score_range: [70, 84], meaning: "Mostly even distribution with minor clustering; low-to-moderate risk signals." },
      { label: "fair", score_range: [50, 69], meaning: "Noticeable clustering/unevenness, early patchiness, or density drop suggesting overharvest risk." },
      { label: "poor", score_range: [0, 49], meaning: "Clear overharvesting, patchy donor, unsafe-zone harvesting, or high scarring risk pattern." },
    ],
    common_failure_patterns: [
      "Clustered extractions / localized density depletion",
      "Moth-eaten/patchy appearance",
      "Harvesting too low/high (unsafe zone) when visible",
      "Overly tight spacing between punches",
    ],
  },
  extraction_quality: {
    id: "EQ",
    title: "Extraction quality",
    weight: 0.14,
    definition:
      "Technical quality of extraction sites: punch control (angle/centering), signs of large punch, doubles/multiples, transection risk signals, and donor trauma consistency.",
    required_evidence_types: ["images"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Clean, consistent sites; minimal trauma; no clear doubles/multiples; punch size appears appropriate." },
      { label: "good", score_range: [70, 84], meaning: "Minor inconsistencies; limited suspected doubles; overall controlled extraction." },
      { label: "fair", score_range: [50, 69], meaning: "Frequent large-looking sites, repeated close hits, or multiple suspected doubles increasing scarring risk." },
      { label: "poor", score_range: [0, 49], meaning: "Widespread trauma pattern, clear doubles/multiples, very large punch appearance, or high-risk technique signals." },
    ],
    common_failure_patterns: [
      "Large-appearing punch sites relative to spacing",
      "Double punches/multiples visible",
      "Jagged/irregular wounds suggesting trauma",
      "Repeated extractions too close together",
    ],
  },
  recipient_placement: {
    id: "RP",
    title: "Recipient placement",
    weight: 0.14,
    definition:
      "Recipient-area placement pattern and technical consistency: spacing, directionality/angulation cues (as visible), clustering, and avoidance of visible cobblestoning/trauma in available photos.",
    required_evidence_types: ["images"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Consistent placement pattern; appropriate spacing; low trauma appearance." },
      { label: "good", score_range: [70, 84], meaning: "Mostly consistent; minor spacing variability; limited trauma." },
      { label: "fair", score_range: [50, 69], meaning: "Noticeable uneven density, clustering, or higher trauma pattern raising growth/cosmesis risk." },
      { label: "poor", score_range: [0, 49], meaning: "Highly inconsistent placement, significant trauma pattern, or clear design/technical issues in recipient area." },
    ],
    common_failure_patterns: [
      "Clustering / patchy placement",
      "Inconsistent spacing across zones",
      "High trauma / crusting pattern beyond expected (view-dependent)",
    ],
  },
  hairline_design: {
    id: "HD",
    title: "Hairline design",
    weight: 0.12,
    definition:
      "Macro hairline planning and naturalness: appropriate position, symmetry, temporal points integration, and softness/irregularity (when visible).",
    required_evidence_types: ["images"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Natural macro design; appropriate height/shape; good symmetry and framing." },
      { label: "good", score_range: [70, 84], meaning: "Generally natural; small design compromises or limited photo proof." },
      { label: "fair", score_range: [50, 69], meaning: "Design appears aggressive/flat/symmetric; limited irregularity; moderate aesthetic risk." },
      { label: "poor", score_range: [0, 49], meaning: "Clearly unnatural macro design (overly straight/low) or major asymmetry concerns." },
    ],
    common_failure_patterns: [
      "Overly straight/flat hairline",
      "Too low/aggressive design for age/context",
      "Asymmetry / poor temporal transition",
    ],
  },
  density_distribution: {
    id: "DD",
    title: "Density distribution",
    weight: 0.1,
    definition:
      "Planned/observed density distribution across zones: balanced allocation, gradient (hairline vs midscalp), and avoidance of abrupt transitions (as visible).",
    required_evidence_types: ["images", "answers"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Balanced, zone-appropriate density planning with natural gradients." },
      { label: "good", score_range: [70, 84], meaning: "Mostly balanced; minor transition risks or limited evidence." },
      { label: "fair", score_range: [50, 69], meaning: "Uneven allocation; abrupt transitions likely; higher aesthetic risk." },
      { label: "poor", score_range: [0, 49], meaning: "Clearly mismatched allocation likely to look unnatural or fail to meet goals." },
    ],
    common_failure_patterns: [
      "Abrupt density transitions",
      "Over-densifying one zone at expense of others",
      "Sparse hairline with dense midscalp (or vice versa) without rationale",
    ],
  },
  graft_handling_and_viability: {
    id: "GH",
    title: "Graft handling & viability (answers-based)",
    weight: 0.1,
    definition:
      "Protocol quality for graft handling: out-of-body time, hydration/storage solution, chilling, counting/quality control, and team workflow—based on survey answers/documentation.",
    required_evidence_types: ["answers"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Clear, consistent protocols and documentation; low viability risk." },
      { label: "good", score_range: [70, 84], meaning: "Reasonable protocols but some missing details." },
      { label: "fair", score_range: [50, 69], meaning: "Key protocol details missing or inconsistent; moderate viability risk." },
      { label: "poor", score_range: [0, 49], meaning: "No clear protocols; high viability risk due to unknown handling conditions." },
    ],
    common_failure_patterns: [
      "No mention of storage solution / temperature control",
      "Unclear out-of-body time",
      "Inconsistent answers between clinic/doctor",
    ],
  },
  post_op_course_and_aftercare: {
    id: "PO",
    title: "Post-op course & aftercare (answers-based)",
    weight: 0.08,
    definition:
      "Aftercare instructions quality, adherence plan, follow-up schedule, and expected course education—based on answers/documentation.",
    required_evidence_types: ["answers"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Clear, comprehensive instructions and follow-up plan; good safety coverage." },
      { label: "good", score_range: [70, 84], meaning: "Adequate instructions with minor gaps." },
      { label: "fair", score_range: [50, 69], meaning: "Incomplete instructions; moderate risk of avoidable issues." },
      { label: "poor", score_range: [0, 49], meaning: "Minimal/unclear aftercare; high risk due to missing guidance." },
    ],
    common_failure_patterns: [
      "No clear wash/med schedule guidance",
      "No follow-up plan stated",
      "Inconsistent instructions across sources",
    ],
  },
  complications_and_risks: {
    id: "CR",
    title: "Complications & risks",
    weight: 0.1,
    definition:
      "Risk profile and complication signals: infection/necrosis risk cues, overharvest scarring risk, shock loss risk, and documentation/response to adverse events (as available).",
    required_evidence_types: ["images", "answers"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "Low complication signals; risks acknowledged/managed; no red flags." },
      { label: "good", score_range: [70, 84], meaning: "Some risk factors but mitigations present; limited red flags." },
      { label: "fair", score_range: [50, 69], meaning: "Multiple risk signals or missing mitigations/documentation." },
      { label: "poor", score_range: [0, 49], meaning: "Strong complication/red-flag signals or major safety/documentation gaps." },
    ],
    common_failure_patterns: [
      "Signs suggestive of high trauma or overharvest risk",
      "Missing adverse-event plan / unclear safety steps",
      "Inconsistent documentation of complications",
    ],
  },
  naturalness_and_aesthetics: {
    id: "NA",
    title: "Naturalness & aesthetics",
    weight: 0.1,
    definition:
      "Overall expected aesthetic naturalness based on placement patterns and design: softness, irregularity, zone transitions, and macro symmetry (view-dependent).",
    required_evidence_types: ["images"],
    bands: [
      { label: "excellent", score_range: [85, 100], meaning: "High likelihood of natural appearance based on visible planning/patterns." },
      { label: "good", score_range: [70, 84], meaning: "Likely natural with minor concerns or limited evidence." },
      { label: "fair", score_range: [50, 69], meaning: "Moderate risk of unnatural look due to design/placement cues." },
      { label: "poor", score_range: [0, 49], meaning: "High risk of unnatural appearance based on strong design/placement red flags." },
    ],
    common_failure_patterns: [
      "Overly uniform, symmetric patterns",
      "Abrupt transitions / unnatural hairline macro cues",
      "Placement clustering that may appear pluggy",
    ],
  },
};

const SECTION_WEIGHTS = {
  donor_management: AUDIT_RUBRIC.donor_management.weight,
  extraction_quality: AUDIT_RUBRIC.extraction_quality.weight,
  recipient_placement: AUDIT_RUBRIC.recipient_placement.weight,
  hairline_design: AUDIT_RUBRIC.hairline_design.weight,
  density_distribution: AUDIT_RUBRIC.density_distribution.weight,
  graft_handling_and_viability: AUDIT_RUBRIC.graft_handling_and_viability.weight,
  post_op_course_and_aftercare: AUDIT_RUBRIC.post_op_course_and_aftercare.weight,
  complications_and_risks: AUDIT_RUBRIC.complications_and_risks.weight,
  naturalness_and_aesthetics: AUDIT_RUBRIC.naturalness_and_aesthetics.weight,
} as const;

function rubricToPrompt(): string {
  const lines: string[] = [];
  for (const [k, def] of Object.entries(AUDIT_RUBRIC) as Array<[keyof typeof AUDIT_RUBRIC, RubricSectionDef]>) {
    lines.push(
      `- ${String(k)} [${def.id}] weight=${def.weight} evidence=${def.required_evidence_types.join("+")}\n` +
        `  definition: ${def.definition}\n` +
        `  bands: ${def.bands.map((b) => `${b.label} ${b.score_range[0]}–${b.score_range[1]} (${b.meaning})`).join(" | ")}\n` +
        `  common failures: ${def.common_failure_patterns.join("; ")}`
    );
  }
  return lines.join("\n");
}

const FORENSIC_AUDIT_JSON_SCHEMA = {
  name: "hairaudit_forensic_audit_v3",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "overall_score",
      "confidence",
      "confidence_label",
      "data_quality",
      "section_scores",
      "section_score_evidence",
      "key_findings",
      "red_flags",
      "photo_observations",
      "summary",
      "non_medical_disclaimer",
      "model",
      "score",
      "donor_quality",
      "graft_survival_estimate",
      "notes",
      "findings",
    ],
    properties: {
      overall_score: { type: "integer", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      confidence_label: { type: "string", enum: ["low", "medium", "high"] },
      data_quality: {
        type: "object",
        additionalProperties: false,
        required: ["missing_inputs", "missing_photos", "limitations"],
        properties: {
          missing_inputs: { type: "array", items: { type: "string" }, maxItems: 20 },
          missing_photos: { type: "array", items: { type: "string" }, maxItems: 30 },
          limitations: { type: "array", items: { type: "string" }, maxItems: 30 },
        },
      },
      section_scores: {
        type: "object",
        additionalProperties: false,
        required: [
          "donor_management",
          "extraction_quality",
          "recipient_placement",
          "hairline_design",
          "density_distribution",
          "graft_handling_and_viability",
          "post_op_course_and_aftercare",
          "complications_and_risks",
          "naturalness_and_aesthetics",
        ],
        properties: {
          donor_management: { type: "integer", minimum: 0, maximum: 100 },
          extraction_quality: { type: "integer", minimum: 0, maximum: 100 },
          recipient_placement: { type: "integer", minimum: 0, maximum: 100 },
          hairline_design: { type: "integer", minimum: 0, maximum: 100 },
          density_distribution: { type: "integer", minimum: 0, maximum: 100 },
          graft_handling_and_viability: { type: "integer", minimum: 0, maximum: 100 },
          post_op_course_and_aftercare: { type: "integer", minimum: 0, maximum: 100 },
          complications_and_risks: { type: "integer", minimum: 0, maximum: 100 },
          naturalness_and_aesthetics: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
      section_score_evidence: {
        type: "object",
        additionalProperties: false,
        required: [
          "donor_management",
          "extraction_quality",
          "recipient_placement",
          "hairline_design",
          "density_distribution",
          "graft_handling_and_viability",
          "post_op_course_and_aftercare",
          "complications_and_risks",
          "naturalness_and_aesthetics",
        ],
        properties: {
          donor_management: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          extraction_quality: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          recipient_placement: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          hairline_design: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          density_distribution: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          graft_handling_and_viability: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          post_op_course_and_aftercare: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          complications_and_risks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          naturalness_and_aesthetics: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
      },
      key_findings: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "severity", "evidence", "impact", "recommended_next_step"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 120 },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source_type", "source_key", "observation", "confidence"],
                properties: {
                  source_type: { type: "string", enum: ["photo", "patient_answer", "doctor_answer", "clinic_answer"] },
                  source_key: { type: "string", minLength: 1, maxLength: 500 },
                  observation: { type: "string", minLength: 1, maxLength: 260 },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
              },
            },
            // Narrative depth: impact is the clinical-grade explanation (2–4 sentences).
            impact: { type: "string", minLength: 1, maxLength: 900 },
            recommended_next_step: { type: "string", minLength: 1, maxLength: 350 },
          },
        },
      },
      red_flags: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["flag", "why_it_matters", "evidence"],
          properties: {
            flag: { type: "string", minLength: 1, maxLength: 140 },
            why_it_matters: { type: "string", minLength: 1, maxLength: 300 },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source_type", "source_key", "observation", "confidence"],
                properties: {
                  source_type: { type: "string", enum: ["photo", "patient_answer", "doctor_answer", "clinic_answer"] },
                  source_key: { type: "string", minLength: 1, maxLength: 500 },
                  observation: { type: "string", minLength: 1, maxLength: 260 },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
              },
            },
          },
        },
      },
      photo_observations: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "image_url",
            "suspected_view",
            "what_can_be_assessed",
            "what_cannot",
            "observations",
            "confidence",
          ],
          properties: {
            image_url: { type: "string", minLength: 1, maxLength: 500 },
            suspected_view: {
              type: "string",
              enum: [
                "preop_front",
                "preop_left",
                "preop_right",
                "preop_top",
                "preop_crown",
                "donor_rear",
                "donor_sides",
                "intraop_recipient",
                "intraop_donor",
                "postop_day0",
                "postop_healed",
                "unknown",
              ],
            },
            what_can_be_assessed: { type: "array", items: { type: "string" }, maxItems: 12 },
            what_cannot: { type: "array", items: { type: "string" }, maxItems: 12 },
            observations: { type: "array", items: { type: "string" }, maxItems: 25 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      summary: { type: "string", minLength: 1, maxLength: 1400 },
      non_medical_disclaimer: { type: "string", minLength: 1, maxLength: 400 },
      model: { type: "string", minLength: 1, maxLength: 80 },

      // Backward-compatible legacy keys
      score: { type: "integer", minimum: 0, maximum: 100 },
      donor_quality: { type: "string", minLength: 1, maxLength: 40 },
      graft_survival_estimate: { type: "string", minLength: 1, maxLength: 40 },
      notes: { type: "string", minLength: 1, maxLength: 1400 },
      findings: { type: "array", items: { type: "string" }, maxItems: 20 },
    },
  },
} as const;

function formatAnswersForPrompt(answers: Record<string, unknown> | null | undefined): string {
  if (!answers || typeof answers !== "object") return "(none provided)";
  const lines: string[] = [];
  for (const [key, val] of Object.entries(answers)) {
    if (val === null || val === undefined) continue;
    const v = Array.isArray(val) ? val.join(", ") : String(val);
    if (v.trim()) lines.push(`  - ${key}: ${v}`);
  }
  return lines.length ? lines.join("\n") : "(none provided)";
}

function formatPatientBaselineForPrompt(baseline: PatientBaseline | null | undefined): string {
  if (!baseline) return "(none provided)";
  const lines: string[] = [];
  for (const [key, val] of Object.entries(baseline)) {
    if (val === null || val === undefined) continue;
    const v = Array.isArray(val) ? val.join(", ") : String(val);
    if (v.trim()) lines.push(`  - ${key}: ${v}`);
  }
  return lines.length ? lines.join("\n") : "(none provided)";
}

function formatEnhancedPatientAnswersForPrompt(enhanced: EnhancedPatientAnswers | null | undefined): string {
  if (!enhanced) return "(none provided)";
  const lines: string[] = [];
  const pushSection = (title: string, obj: Record<string, unknown> | null | undefined) => {
    if (!obj || typeof obj !== "object") return;
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && String(v).trim().length > 0);
    if (entries.length === 0) return;
    lines.push(`- ${title}:`);
    for (const [k, v] of entries) lines.push(`  - ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  pushSection("baseline", enhanced.baseline as unknown as Record<string, unknown> | undefined);
  pushSection("hair_biology", enhanced.hair_biology as unknown as Record<string, unknown> | undefined);
  pushSection("donor_profile", enhanced.donor_profile as unknown as Record<string, unknown> | undefined);
  pushSection("procedure_execution", enhanced.procedure_execution as unknown as Record<string, unknown> | undefined);
  pushSection("graft_handling", enhanced.graft_handling as unknown as Record<string, unknown> | undefined);
  pushSection("healing_course", enhanced.healing_course as unknown as Record<string, unknown> | undefined);
  pushSection("aesthetics", enhanced.aesthetics as unknown as Record<string, unknown> | undefined);
  pushSection("experience", enhanced.experience as unknown as Record<string, unknown> | undefined);
  return lines.length ? lines.join("\n") : "(none provided)";
}

function extractGraftHandlingEvidence(input: AIAuditInput) {
  const patient = (input.patient_answers ?? {}) as Record<string, unknown>;
  const enhanced = (input.enhanced_patient_answers ?? {}) as Record<string, unknown>;
  const graftHandling = (enhanced.graft_handling ?? {}) as Record<string, unknown>;
  const baselineFromFlat = (patient.enhanced_patient_answers as Record<string, unknown> | undefined)?.graft_handling as
    | Record<string, unknown>
    | undefined;
  const merged = { ...(baselineFromFlat ?? {}), ...graftHandling };
  const val = (k: string) => String((merged as any)?.[k] ?? (patient as any)?.[k] ?? "").trim();
  return {
    out_of_body_time_estimate: val("out_of_body_time_estimate"),
    storage_solution: val("storage_solution"),
    temperature_control: val("temperature_control"),
    grafts_kept_hydrated: val("grafts_kept_hydrated"),
  };
}

function enforceNarrativeGrounding(
  result: Pick<AIAuditResult, "summary" | "key_findings">,
  evidence: ReturnType<typeof extractGraftHandlingEvidence>
) {
  const hasValue = (v: string) => v.length > 0 && v.toLowerCase() !== "not sure";
  const needsInsufficient = {
    outOfBody: !hasValue(evidence.out_of_body_time_estimate),
    chilling: !hasValue(evidence.temperature_control),
    hydration: !hasValue(evidence.grafts_kept_hydrated),
  };

  const sentenceFilter = (text: string) => {
    const chunks = String(text)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const kept: string[] = [];
    let replaced = false;

    for (const sentence of chunks) {
      const low = sentence.toLowerCase();
      const mentionsOutOfBody = /out[- ]of[- ]body|ischemia|prolonged holding/.test(low);
      const mentionsChilling = /chill|cold|temperature control|hypotherm/.test(low);
      const mentionsHydration = /hydration|hydrated|desiccation|dry(ing)? graft/.test(low);

      if ((mentionsOutOfBody && needsInsufficient.outOfBody) || (mentionsChilling && needsInsufficient.chilling) || (mentionsHydration && needsInsufficient.hydration)) {
        replaced = true;
        continue;
      }
      kept.push(sentence);
    }

    if (replaced) {
      kept.push(
        "Evidence was insufficient to confirm out-of-body duration, chilling conditions, and hydration workflow from the submitted inputs."
      );
    }
    return kept.join(" ").trim();
  };

  return {
    summary: sentenceFilter(result.summary),
    key_findings: (result.key_findings ?? []).map((kf) => ({
      ...kf,
      impact: sentenceFilter(String(kf.impact ?? "")),
    })),
  };
}

/** Run AI audit on answers + optionally images. Returns structured audit result. */
export async function runAIAudit(input: AIAuditInput): Promise<AIAuditResult> {
  const CONFIDENCE_FLOOR = 0.45;
  const CONFIDENCE_CAP = 0.92;
  const NEUTRAL_SCORE_IF_INSUFFICIENT_EVIDENCE = 60;

  const apiKey = process.env.OPENAI_API_KEY;
  const imageInputs = (input.imageInputs ?? [])
    .filter((x) => x && typeof x.sourceKey === "string" && typeof x.dataBase64 === "string" && x.dataBase64.length > 0)
    .slice(0, 10);
  const failedImageKeys = Array.from(new Set((input.failedImageKeys ?? []).map((x) => String(x).trim()).filter(Boolean)));
  const requestedImageCount = Math.max(
    Number.isFinite(Number(input.requestedImageCount)) ? Math.round(Number(input.requestedImageCount)) : 0,
    imageInputs.length + failedImageKeys.length
  );
  const auditMode = input.auditMode ?? "full";
  const isPatientOnly = auditMode === "patient";

  const autoMissingInputs: string[] = [];
  if (!input.patient_answers || Object.keys(input.patient_answers).length === 0) autoMissingInputs.push("patient_answers");
  if (!isPatientOnly) {
    if (!input.doctor_answers || Object.keys(input.doctor_answers).length === 0) autoMissingInputs.push("doctor_answers");
    if (!input.clinic_answers || Object.keys(input.clinic_answers).length === 0) autoMissingInputs.push("clinic_answers");
  }
  const autoMissingPhotos: string[] = imageInputs.length > 0 ? [] : ["photos"];

  if (!apiKey) {
    const section_scores = {
      donor_management: 0,
      extraction_quality: 0,
      recipient_placement: 0,
      hairline_design: 0,
      density_distribution: 0,
      graft_handling_and_viability: 0,
      post_op_course_and_aftercare: 0,
      complications_and_risks: 0,
      naturalness_and_aesthetics: 0,
    };
    const section_score_evidence = {
      donor_management: ["insufficient evidence: no images provided (and AI disabled)"],
      extraction_quality: ["insufficient evidence: no images provided (and AI disabled)"],
      recipient_placement: ["insufficient evidence: no images provided (and AI disabled)"],
      hairline_design: ["insufficient evidence: no images provided (and AI disabled)"],
      density_distribution: ["insufficient evidence: no images provided (and AI disabled)"],
      graft_handling_and_viability: ["insufficient evidence: answers not evaluated (and AI disabled)"],
      post_op_course_and_aftercare: ["insufficient evidence: answers not evaluated (and AI disabled)"],
      complications_and_risks: ["insufficient evidence: AI disabled"],
      naturalness_and_aesthetics: ["insufficient evidence: no images provided (and AI disabled)"],
    };
    return {
      overall_score: 0,
      confidence: CONFIDENCE_FLOOR,
      confidence_label: "low",
      data_quality: {
        missing_inputs: autoMissingInputs,
        missing_photos: autoMissingPhotos,
        limitations: ["AI audit skipped: OPENAI_API_KEY not configured."],
      },
      section_scores,
      section_score_evidence,
      key_findings: [],
      red_flags: [],
      photo_observations: [],
      summary: "AI audit skipped because the OpenAI key is not configured.",
      non_medical_disclaimer:
        "HairAudit is an informational audit/reporting tool and not a medical diagnosis or medical advice.",
      model: "none",
      // Deprecated fields (back-compat)
      score: 0,
      donor_quality: "Cannot assess",
      graft_survival_estimate: "Unknown",
      notes: "AI audit skipped: OPENAI_API_KEY not configured.",
      findings: [],
    };
  }

  const client = new OpenAI({ apiKey });

  const patientBlock = formatAnswersForPrompt(input.patient_answers);
  const doctorBlock = formatAnswersForPrompt(input.doctor_answers);
  const clinicBlock = formatAnswersForPrompt(input.clinic_answers);
  const baselineBlock = formatPatientBaselineForPrompt(input.patient_baseline);
  const enhancedPatientBlock = formatEnhancedPatientAnswersForPrompt(input.enhanced_patient_answers);

  const systemPrompt = `You are an expert hair transplant auditor producing a forensic audit for HairAudit + Follicle Intelligence.

## Safety + legal guardrails (STRICT)
- No diagnosis. No treatment plan. No medication directives. No dosing, prescribing, or "you should take/do X medically".
- Do not use inflammatory or legal-judgment language, including: "negligence", "negligent", "malpractice", "botched", "fraud", "scam", "criminal", "lawsuit".
- Do not accuse or attribute intent. Do not state causation as fact when it cannot be confirmed from inputs.
- Use neutral audit phrasing with uncertainty where appropriate:
  - "pattern is consistent with…", "may indicate…", "could be associated with…", "cannot confirm without…", "insufficient evidence…"
- Avoid identifying individuals or clinics in a negative way. Do not name or single out people/organizations for blame. Focus on technical observations only.
- Always include the non_medical_disclaimer field and keep it neutral.

You MUST be objective and evidence-based. Use audit language only: quality indicators, risk flags, and data insufficiency.

${isPatientOnly ? `## Audit mode: PATIENT-ONLY
This is a patient audit. Doctor and clinic documentation are NOT provided and are NOT expected.
- Evaluate ONLY based on patient answers and patient-submitted photos.
- Do NOT list doctor_answers, clinic_answers, doctor photos, or clinic requirements as missing, limiters, or in data_quality.limitations.
- In limitations, NEVER mention: "clinic answers", "doctor answers", "missing clinic", "missing doctor", "no clinic", "no doctor", or any doctor/clinic documentation.
- Score and assess based solely on available patient evidence.` : ""}

## Forensic inference objectives (answers-driven; MUST APPLY WHEN POSSIBLE)
Using patient-provided answers (and any structured enhanced inputs), you must infer and discuss (without diagnosing):
- Donor risk (safe-donor preservation + long-term limitations)
- Graft survival likelihood (conditional, not a promise)
- Desiccation risk (graft out-of-body / hydration / storage / temperature workflow)
- Overharvesting risk (pattern + count + donor baseline, when available)
- Aesthetic consistency risk (hairline/temple/crown logic + directionality, conditional on evidence)
- Healing trajectory stage (based on stated postop timing + symptoms; if timing absent, say insufficient evidence)
- Confidence adjustments based on data completeness (missing data lowers confidence, not section scores)

## Narrative grounding requirements (STRICT)
- Never claim extended out-of-body time unless input explicitly contains out_of_body_time_estimate.
- Never claim chilling/cold storage unless input explicitly contains temperature_control.
- Never claim hydration/desiccation handling unless input explicitly contains grafts_kept_hydrated and/or storage_solution.
- If any of the above are missing or "Not sure", you must state "evidence was insufficient" instead of inferring details.

## Scoring rubric (MUST FOLLOW)
${rubricToPrompt()}

## Comprehensive checklist (MUST EXPLICITLY CONSIDER WHEN EVIDENCE ALLOWS)
When evidence is missing or unclear, you MUST mark it explicitly as "insufficient evidence:" in the relevant section_score_evidence entries and add a corresponding item to data_quality.limitations.
Critical: missing/unclear evidence should LOWER confidence rather than forcing assumptions or punishing section_scores. If you lack evidence for a section, keep section_scores near a neutral default (around 55–65) and clearly mark the evidence as insufficient.

### DONOR / EXTRACTION (primarily photos: donor_rear, donor_sides, intraop_donor, postop_healed)
- Uniform extraction distribution (avoid clustered harvesting)
- Signs of overharvesting / moth-eaten pattern
- Punch trauma indicators (view-dependent):
  - Perifollicular erythema patterns (acute), cobblestoning, pitting/ridging
  - Hypopigmented dots (healed) / visible dot scarring pattern
- Donor area management and “safe zone” consistency (only if safe-zone boundaries are inferable from views)
- Shock-loss risk indicators (diffuse donor thinning, aggressive extraction density)

### RECIPIENT / PLACEMENT (photos: intraop_recipient, postop_day0, postop_healed; preop views for context)
- Angle + direction consistency (especially hairline + temples) if visible
- Spacing / row patterns (pluggy rows vs randomized/feathered)
- Graft size appropriateness (single-hair zone vs multi-hair creeping forward)
- Density gradients (hairline transition → midscalp)
- Crown whirl alignment (only if preop_crown / crown region exists)

### HAIRLINE DESIGN (macro-aesthetics) (photos: preop_front/left/right, postop views)
- Age-appropriate height and shape (use only evidence available; if patient age not provided, note uncertainty)
- Temporal recession logic and transition into temples
- Micro-irregularity / broken line (avoid overly straight edge)
- Symmetry vs natural asymmetry
- Temple point strategy (if applicable / visible)

### GRAFT SURVIVAL & VIABILITY (inferred; DO NOT overclaim)
- Pattern consistency suggesting survival vs patchy take (only if healed photos exist; otherwise insufficient evidence)
- Mismatch between claimed grafts and visible density: flag as UNCERTAINTY, not an accusation
- Reliance on answers for storage/holding time, hydration, handling, implanter usage, etc.

### POST-OP COURSE / AFTERCARE (answers-based; and optionally postop photos for stage consistency)
- Cleaning protocol, scab management
- Infection risk behaviours (if provided)
- Medication adherence (if provided)
- Realistic timelines and whether current stage matches expected growth window (only if timing is provided; otherwise insufficient evidence)

## Output rules (STRICT)
- You must produce:
  1) section_scores (0–100 integers) for all sections
  2) section_score_evidence with 1–3 evidence items per section.
     - Each evidence item must include:
       - Rubric ID in brackets, e.g. "[EQ]"
       - Evidence source prefix: "photo:<suspected_view>" or "answers:<field>"
       - A short criterion statement tied to the checklist (not generic).
     - If insufficient: start with "insufficient evidence:" and say what is missing (e.g., "insufficient evidence: no donor_rear/donor_sides close-ups to assess extraction distribution").
  3) photo_observations: one entry per image URL, even if suspected_view is "unknown".
  4) key_findings and red_flags MUST be evidence-anchored:
     - key_findings[].evidence and red_flags[].evidence MUST be arrays of structured evidence objects:
       { source_type: "photo" | "patient_answer" | "doctor_answer" | "clinic_answer",
         source_key: image_url OR answer key,
         observation: short objective statement (no diagnosis),
         confidence: 0–1 }
     - Each key_findings[] and red_flags[] must include at least 1 evidence object.
     - If no evidence exists, include a single evidence object with observation starting "insufficient evidence:" and confidence <= 0.2,
       and lower overall confidence + add a data_quality limitation.
  5) Narrative depth requirement (STRICT):
     - Minimum narrative depth: at least 350 words total across "summary" + all "key_findings[].impact".
     - Provide detailed clinical-grade explanations under each key finding.
     - key_findings[].impact MUST be 2–4 sentences for each major finding and MUST explicitly include:
       (a) why it matters clinically,
       (b) what supports the observation (tie to evidence objects / section_score_evidence),
       (c) a potential long-term implication (stated conditionally; no overclaiming).
     - Use structured reasoning summaries (what/why/implication) but DO NOT provide chain-of-thought or step-by-step internal reasoning.
- Strict output integrity:
  - Follow the JSON Schema exactly (no extra keys).
  - Do not output nulls unless the schema explicitly allows it.
  - confidence must be > 0 and never 0.
  - Overall confidence must never be below 0.45.
- Unknown/unclear photos MUST NOT drive section_scores; they should reduce confidence and add data_quality limitations instead.
- If photos/angles are missing, explicitly say so and lower confidence + label (low/medium/high).

Safety:
- No medical advice. Use audit language: risk flags, quality indicators, and requests for clearer documentation/photos.`;

  const userContent: (OpenAI.Chat.Completions.ChatCompletionContentPart)[] = [
    {
      type: "text",
      text:
        `## Inputs\n` +
        `Auto-detected missing inputs: ${autoMissingInputs.length ? autoMissingInputs.join(", ") : "(none)"}\n` +
        `Auto-detected missing photos: ${autoMissingPhotos.length ? autoMissingPhotos.join(", ") : "(none)"}\n\n` +
        `## Patient baseline\n${baselineBlock}\n\n` +
        `## Enhanced patient answers (structured)\n${enhancedPatientBlock}\n\n` +
        `## Patient answers\n${patientBlock}\n\n## Doctor answers\n${doctorBlock}\n\n## Clinic answers\n${clinicBlock}\n\n` +
        `Return a forensic audit that strictly conforms to the provided JSON Schema (no extra keys).`,
    },
  ];

  if (imageInputs.length > 0) {
    userContent.push({
      type: "text",
      text:
        "\n## Photos to analyze (VIEW-AWARE)\n" +
        "You MUST create one photo_observations[] entry per image_source_key, even if you're unsure.\n" +
        "For each photo, classify suspected_view as one of:\n" +
        '["preop_front","preop_left","preop_right","preop_top","preop_crown","donor_rear","donor_sides","intraop_recipient","intraop_donor","postop_day0","postop_healed","unknown"]\n' +
        "Then list what_can_be_assessed, what_cannot (angle/lighting/blur/occlusion/distance), 2–6 short observations, and a confidence 0–1.\n" +
        "Unknown/unclear photos should LOWER confidence and add limitations, not change section scores.\n" +
        "When donor/extraction sites are visible, explicitly address: extraction distribution/spread, qualitative punch size, doubles/multiples, overharvesting/patchiness.",
    });
    for (const image of imageInputs) {
      userContent.push({
        type: "text",
        text: `image_source_key: ${image.sourceKey}`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${image.mimeType || "image/jpeg"};base64,${image.dataBase64}` },
      });
    }
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const clampIntScore = (n: unknown) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
  };
  const clamp01 = (n: unknown) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  };
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const countNonEmpty = (obj: Record<string, unknown> | null | undefined): number => {
    if (!obj || typeof obj !== "object") return 0;
    let c = 0;
    for (const v of Object.values(obj)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim().length === 0) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      c += 1;
    }
    return c;
  };
  const uniq = (xs: string[]) => Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));
  const confidenceLabelFrom = (c: number): "low" | "medium" | "high" => (c < 0.55 ? "low" : c < 0.8 ? "medium" : "high");
  const computeOverall = (sections: AIAuditResult["section_scores"]) => {
    let sum = 0;
    for (const [k, w] of Object.entries(SECTION_WEIGHTS) as Array<[keyof typeof SECTION_WEIGHTS, number]>) {
      sum += Number(sections[k] ?? 0) * w;
    }
    return clampIntScore(sum);
  };
  const evidenceIsWeak = (items: string[] | undefined) => {
    const xs = (items ?? []).map((x) => String(x).trim()).filter(Boolean);
    if (xs.length === 0) return true;
    return xs.every((x) => x.toLowerCase().startsWith("insufficient evidence:"));
  };

  const donorQualityFrom = (donorManagement: number, extractionQuality: number, donorEvidenceWeak: boolean): string => {
    if (donorEvidenceWeak) return "Cannot assess";
    const s = Math.round((donorManagement + extractionQuality) / 2);
    if (s >= 85) return "Excellent";
    if (s >= 70) return "Good";
    if (s >= 50) return "Fair";
    return "Poor";
  };

  const graftSurvivalFrom = (
    recipientPlacement: number,
    densityDistribution: number,
    complicationsAndRisks: number,
    evidenceWeak: boolean
  ): string => {
    if (evidenceWeak) return "Unknown";
    // Conservative composite: technique signals (placement + distribution) moderated by risk profile.
    const composite = Math.round(recipientPlacement * 0.4 + densityDistribution * 0.4 + complicationsAndRisks * 0.2);
    if (composite >= 85) return "85-95%";
    if (composite >= 70) return "75-90%";
    if (composite >= 55) return "65-80%";
    return "50-70%";
  };

  try {
    const tokenParam = maxTokensParam(model, imageInputs.length > 0 ? 4096 : 2048);
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: { type: "json_schema", json_schema: FORENSIC_AUDIT_JSON_SCHEMA } as any,
      temperature: 0.2,
      ...(tokenParam as any),
    });

    const choice = completion.choices[0];
    const raw = choice?.message?.content;
    if (!raw) {
      const reason = choice?.finish_reason ?? "unknown";
      const msg = (choice?.message as { refusal?: string } | undefined)?.refusal;
      throw new Error(`Empty AI response (finish_reason: ${reason}${msg ? `, refusal: ${msg}` : ""})`);
    }

    const parsed = JSON.parse(raw) as AIAuditResult;

    // Enforce invariants (and the acceptance criteria) server-side.
    const section_scores: AIAuditResult["section_scores"] = {
      donor_management: clampIntScore(parsed.section_scores?.donor_management),
      extraction_quality: clampIntScore(parsed.section_scores?.extraction_quality),
      recipient_placement: clampIntScore(parsed.section_scores?.recipient_placement),
      hairline_design: clampIntScore(parsed.section_scores?.hairline_design),
      density_distribution: clampIntScore(parsed.section_scores?.density_distribution),
      graft_handling_and_viability: clampIntScore(parsed.section_scores?.graft_handling_and_viability),
      post_op_course_and_aftercare: clampIntScore(parsed.section_scores?.post_op_course_and_aftercare),
      complications_and_risks: clampIntScore(parsed.section_scores?.complications_and_risks),
      naturalness_and_aesthetics: clampIntScore(parsed.section_scores?.naturalness_and_aesthetics),
    };

    const ensureEvidence = (xs: unknown, fallback: string): string[] => {
      const arr = Array.isArray(xs) ? xs.map((x) => String(x).slice(0, 220)).filter(Boolean) : [];
      if (arr.length === 0) return [fallback];
      return arr.slice(0, 3);
    };

    const section_score_evidence: AIAuditResult["section_score_evidence"] = {
      donor_management: ensureEvidence(parsed.section_score_evidence?.donor_management, "insufficient evidence: donor photos not assessable"),
      extraction_quality: ensureEvidence(parsed.section_score_evidence?.extraction_quality, "insufficient evidence: extraction sites not visible"),
      recipient_placement: ensureEvidence(parsed.section_score_evidence?.recipient_placement, "insufficient evidence: recipient placement not visible"),
      hairline_design: ensureEvidence(parsed.section_score_evidence?.hairline_design, "insufficient evidence: hairline view not available"),
      density_distribution: ensureEvidence(parsed.section_score_evidence?.density_distribution, "insufficient evidence: zone distribution cannot be confirmed"),
      graft_handling_and_viability: ensureEvidence(parsed.section_score_evidence?.graft_handling_and_viability, "insufficient evidence: answers missing for graft handling"),
      post_op_course_and_aftercare: ensureEvidence(parsed.section_score_evidence?.post_op_course_and_aftercare, "insufficient evidence: answers missing for aftercare"),
      complications_and_risks: ensureEvidence(parsed.section_score_evidence?.complications_and_risks, "insufficient evidence: insufficient complication evidence"),
      naturalness_and_aesthetics: ensureEvidence(parsed.section_score_evidence?.naturalness_and_aesthetics, "insufficient evidence: limited aesthetic views"),
    };

    // If evidence is insufficient, keep a neutral (non-zero) score to avoid distorting the radar signature.
    // Confidence (not scores) should absorb the data completeness penalty.
    for (const k of Object.keys(section_scores) as Array<keyof AIAuditResult["section_scores"]>) {
      if (section_scores[k] === 0 && evidenceIsWeak(section_score_evidence[k])) {
        section_scores[k] = NEUTRAL_SCORE_IF_INSUFFICIENT_EVIDENCE;
      }
    }

    const normalizedPhotos: AIAuditResult["photo_observations"] = (() => {
      const src = Array.isArray(parsed.photo_observations) ? parsed.photo_observations : [];
      const byUrl = new Map<string, AIAuditResult["photo_observations"][number]>();
      for (const p of src) {
        if (!p || typeof p !== "object") continue;
        const rec = p as Record<string, unknown>;
        const u0 = rec.image_url;
        if (typeof u0 !== "string" || !u0.trim()) continue;
        const u = u0;
        if (!byUrl.has(u)) byUrl.set(u, p as AIAuditResult["photo_observations"][number]);
      }
      const out: AIAuditResult["photo_observations"] = [];
      const sourceKeys = imageInputs.map((x) => x.sourceKey);
      for (const u of sourceKeys) {
        const p = byUrl.get(u);
        if (p) out.push(p);
        else {
          out.push({
            image_url: u,
            suspected_view: "unknown",
            what_can_be_assessed: [],
            what_cannot: ["insufficient evidence: missing per-photo record"],
            observations: ["insufficient evidence: model did not return an entry for this image URL"],
            confidence: 0,
          });
        }
      }
      return out;
    })();

    const confidenceFromModel = clamp01(parsed.confidence);
    const knownViews = normalizedPhotos.filter((p) => p.suspected_view !== "unknown").length;
    const viewCoverage = imageInputs.length > 0 ? knownViews / imageInputs.length : 1;
    const photoFactor = clamp(imageInputs.length / 6, 0, 1);
    const viewFactor = clamp(viewCoverage, 0, 1);
    const patientCount = countNonEmpty(input.patient_answers ?? undefined);
    const doctorCount = countNonEmpty(input.doctor_answers ?? undefined);
    const clinicCount = countNonEmpty(input.clinic_answers ?? undefined);
    const enhancedCount =
      input.enhanced_patient_answers && typeof input.enhanced_patient_answers === "object"
        ? countNonEmpty(input.enhanced_patient_answers as unknown as Record<string, unknown>)
        : 0;
    const baselineCount =
      input.patient_baseline && typeof input.patient_baseline === "object"
        ? countNonEmpty(input.patient_baseline as unknown as Record<string, unknown>)
        : 0;

    const answerFactor = clamp(
      0.55 * clamp(patientCount / 14, 0, 1) +
        0.2 * clamp(doctorCount / 10, 0, 1) +
        0.15 * clamp(clinicCount / 10, 0, 1) +
        0.05 * clamp(enhancedCount / 6, 0, 1) +
        0.05 * clamp(baselineCount / 6, 0, 1),
      0,
      1
    );
    const missingPenalty = clamp(autoMissingInputs.length / 3, 0, 1) * 0.12;
    const imageFailurePenalty =
      requestedImageCount > 0
        ? clamp(failedImageKeys.length / requestedImageCount, 0, 1) * 0.2
        : 0;

    const derivedCoverageConfidence = clamp(
      CONFIDENCE_FLOOR + 0.3 * photoFactor + 0.2 * viewFactor + 0.3 * answerFactor - missingPenalty - imageFailurePenalty,
      CONFIDENCE_FLOOR,
      CONFIDENCE_CAP
    );

    // Final confidence is bounded by both model self-report and data coverage.
    const modelBounded = clamp(confidenceFromModel || 1, CONFIDENCE_FLOOR, 1);
    const confidence = clamp(Math.min(modelBounded, derivedCoverageConfidence), CONFIDENCE_FLOOR, 1);
    const overall_score = computeOverall(section_scores);
    const confidence_label = confidenceLabelFrom(confidence);

    const data_quality: AIAuditResult["data_quality"] = {
      missing_inputs: uniq([...(parsed.data_quality?.missing_inputs ?? []), ...autoMissingInputs]).slice(0, 20),
      missing_photos: uniq([...(parsed.data_quality?.missing_photos ?? []), ...autoMissingPhotos, ...failedImageKeys]).slice(0, 30),
      limitations: uniq([
        ...(parsed.data_quality?.limitations ?? []),
        ...(failedImageKeys.length
          ? [
              `Some submitted photos could not be downloaded and were excluded from analysis (${failedImageKeys.length}/${requestedImageCount || failedImageKeys.length}).`,
            ]
          : []),
        ...(imageInputs.length > 0 && viewCoverage < 1
          ? [`View coverage incomplete: ${(viewCoverage * 100).toFixed(0)}% of photos confidently classified.`]
          : []),
        ...(!input.patient_baseline ? ["Baseline missing: age/sex/smoking not provided; risk inference limited."] : []),
        ...(!input.enhanced_patient_answers ? ["Structured enhanced answers missing; predictive modeling is limited."] : []),
      ]).slice(0, 30),
    };

    const non_medical_disclaimer =
      "HairAudit is an informational audit/reporting tool and not a medical diagnosis or medical advice.";

    const donorEvidenceWeak =
      evidenceIsWeak(section_score_evidence.donor_management) || evidenceIsWeak(section_score_evidence.extraction_quality);
    const donor_quality = donorQualityFrom(
      section_scores.donor_management,
      section_scores.extraction_quality,
      donorEvidenceWeak
    );

    const survivalEvidenceWeak =
      evidenceIsWeak(section_score_evidence.recipient_placement) ||
      evidenceIsWeak(section_score_evidence.density_distribution) ||
      evidenceIsWeak(section_score_evidence.complications_and_risks);
    const graft_survival_estimate = graftSurvivalFrom(
      section_scores.recipient_placement,
      section_scores.density_distribution,
      section_scores.complications_and_risks,
      survivalEvidenceWeak
    );
    const grounded = enforceNarrativeGrounding(
      { summary: String(parsed.summary ?? ""), key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings : [] },
      extractGraftHandlingEvidence(input)
    );
    const notes = String(grounded.summary ?? "").slice(0, 1400);
    const findings = (Array.isArray(parsed.key_findings) ? parsed.key_findings : [])
      .slice(0, 10)
      .map((f) => String(f.title ?? "").slice(0, 160))
      .filter((s) => s.trim().length > 0);

    return {
      ...parsed,
      summary: grounded.summary,
      key_findings: grounded.key_findings,
      model,
      overall_score,
      confidence,
      confidence_label,
      data_quality,
      section_scores,
      section_score_evidence,
      photo_observations: normalizedPhotos,
      non_medical_disclaimer,
      // Deprecated fields (mapped)
      score: overall_score,
      donor_quality,
      graft_survival_estimate,
      notes,
      findings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const section_scores = {
      donor_management: 0,
      extraction_quality: 0,
      recipient_placement: 0,
      hairline_design: 0,
      density_distribution: 0,
      graft_handling_and_viability: 0,
      post_op_course_and_aftercare: 0,
      complications_and_risks: 0,
      naturalness_and_aesthetics: 0,
    };
    const section_score_evidence = {
      donor_management: ["insufficient evidence: AI audit failed"],
      extraction_quality: ["insufficient evidence: AI audit failed"],
      recipient_placement: ["insufficient evidence: AI audit failed"],
      hairline_design: ["insufficient evidence: AI audit failed"],
      density_distribution: ["insufficient evidence: AI audit failed"],
      graft_handling_and_viability: ["insufficient evidence: AI audit failed"],
      post_op_course_and_aftercare: ["insufficient evidence: AI audit failed"],
      complications_and_risks: ["insufficient evidence: AI audit failed"],
      naturalness_and_aesthetics: ["insufficient evidence: AI audit failed"],
    };
    return {
      overall_score: 0,
      confidence: CONFIDENCE_FLOOR,
      confidence_label: confidenceLabelFrom(CONFIDENCE_FLOOR),
      data_quality: {
        missing_inputs: autoMissingInputs,
        missing_photos: uniq([...autoMissingPhotos, ...failedImageKeys]),
        limitations: [`AI audit failed: ${msg}`],
      },
      section_scores,
      section_score_evidence,
      key_findings: [],
      red_flags: [],
      photo_observations: imageInputs.map((img) => ({
        image_url: img.sourceKey,
        suspected_view: "unknown",
        what_can_be_assessed: [],
        what_cannot: ["AI audit failed"],
        observations: [`AI audit failed: ${msg}`],
        confidence: 0,
      })),
      summary: `AI audit failed: ${msg}`,
      non_medical_disclaimer:
        "HairAudit is an informational audit/reporting tool and not a medical diagnosis or medical advice.",
      model: "error",
      // Deprecated fields (back-compat)
      score: 0,
      donor_quality: "Cannot assess",
      graft_survival_estimate: "Unknown",
      notes: `AI audit failed: ${msg}`,
      findings: [],
    };
  }
}
