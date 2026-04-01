export const TRAINING_PHOTO_PREFIX = "training_photo:" as const;

/** Required surgical photo slots for a training case */
export const ACADEMY_REQUIRED_PHOTO_CATEGORIES = [
  "preop_front",
  "preop_sides",
  "donor_rear",
  "intraop_extraction",
  "intraop_implantation",
  "postop_day0",
] as const;

export const ACADEMY_OPTIONAL_PHOTO_CATEGORIES = [
  "preop_crown",
  "hairline_design",
  "graft_tray",
  "donor_closeup",
  "recipient_closeup",
] as const;

export type AcademyPhotoCategory =
  | (typeof ACADEMY_REQUIRED_PHOTO_CATEGORIES)[number]
  | (typeof ACADEMY_OPTIONAL_PHOTO_CATEGORIES)[number];

export const ACADEMY_SCORING_DOMAINS = [
  "sterile_setup",
  "donor_assessment_awareness",
  "punch_alignment",
  "depth_control",
  "transection_control",
  "extraction_patterning",
  "graft_handling",
  "implantation_angle_direction",
  "density_judgement",
  "speed_flow",
  "tissue_respect",
  "teamwork",
  "adaptability",
  "overall_trainer_confidence",
] as const;

export type AcademyScoringDomain = (typeof ACADEMY_SCORING_DOMAINS)[number];

export const ACADEMY_DOMAIN_LABELS: Record<AcademyScoringDomain, string> = {
  sterile_setup: "Sterile setup",
  donor_assessment_awareness: "Donor assessment awareness",
  punch_alignment: "Punch alignment",
  depth_control: "Depth control",
  transection_control: "Transection control",
  extraction_patterning: "Extraction patterning",
  graft_handling: "Graft handling",
  implantation_angle_direction: "Implantation angle & direction",
  density_judgement: "Density judgement",
  speed_flow: "Speed & flow",
  tissue_respect: "Tissue respect",
  teamwork: "Teamwork",
  adaptability: "Adaptability",
  overall_trainer_confidence: "Overall trainer confidence",
};

export type AcademyUserRole = "academy_admin" | "trainer" | "clinic_staff" | "trainee";

export const DEFAULT_TRAINING_PROGRAM_ID = "a0000000-0000-4000-8000-000000000001";
