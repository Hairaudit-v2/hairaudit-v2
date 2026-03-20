// Single source of truth for photo upload copy (titles, help text, tips)
// Reused across: patient uploader, review summary, admin view

import { PATIENT_AUDIT_PHOTO_BUCKET_DEFS } from "./patientPhotoCategoryConfig";

export type PhotoCategoryDef = {
  key: string;
  title: string;
  help?: string;
  quickTips?: readonly string[];
  min: number;
  max: number;
  required: boolean;
  accept?: string;
};

/* ----- PATIENT SCHEMA (with copy) — buckets defined in patientPhotoCategoryConfig ----- */

export const PATIENT_PHOTO_SCHEMA: PhotoCategoryDef[] = PATIENT_AUDIT_PHOTO_BUCKET_DEFS as PhotoCategoryDef[];

/* ----- DOCTOR SCHEMA (structural only; copy can be extended later) ----- */

export const DOCTOR_PHOTO_SCHEMA: PhotoCategoryDef[] = [
  { key: "img_preop_front", title: "Pre-op Front", min: 1, max: 3, required: true, accept: "image/*" },
  { key: "img_preop_left", title: "Pre-op Left", min: 1, max: 2, required: true, accept: "image/*" },
  { key: "img_preop_right", title: "Pre-op Right", min: 1, max: 2, required: true, accept: "image/*" },
  { key: "img_preop_top", title: "Pre-op Top", min: 1, max: 3, required: true, accept: "image/*" },
  {
    key: "img_preop_crown",
    title: "Pre-op Crown",
    min: 0,
    max: 3,
    required: false,
    help: "Required when crown is included in case scope.",
    accept: "image/*",
  },
  { key: "img_preop_donor_rear", title: "Pre-op Donor Rear", min: 1, max: 3, required: true, accept: "image/*" },
  { key: "img_preop_donor_sides", title: "Pre-op Donor Sides", min: 0, max: 4, required: false, accept: "image/*" },
  { key: "img_marking_design", title: "Marking / Design Images", min: 0, max: 4, required: false, accept: "image/*" },
  { key: "img_immediate_postop_recipient", title: "Immediate Post-op Recipient", min: 1, max: 4, required: true, accept: "image/*" },
  { key: "img_immediate_postop_donor", title: "Immediate Post-op Donor", min: 1, max: 4, required: true, accept: "image/*" },
  { key: "img_intraop_extraction", title: "Intra-op Extraction Images", min: 0, max: 6, required: false, accept: "image/*" },
  { key: "img_graft_inspection", title: "Graft Inspection Images", min: 0, max: 6, required: false, accept: "image/*" },
  { key: "img_graft_tray_overview", title: "Graft Tray Overview Images", min: 0, max: 4, required: false, accept: "image/*" },
  { key: "img_graft_tray_closeup", title: "Graft Tray Close-Up Images", min: 0, max: 8, required: false, accept: "image/*" },
  { key: "img_graft_microscopy", title: "Microscopic Graft Images", min: 0, max: 10, required: false, accept: "image/*" },
  { key: "img_site_creation", title: "Site Creation Images", min: 0, max: 6, required: false, accept: "image/*" },
  { key: "img_implantation_stage", title: "Implantation Stage Images", min: 0, max: 6, required: false, accept: "image/*" },
  {
    key: "img_followup_front",
    title: "Follow-up Front",
    min: 0,
    max: 3,
    required: false,
    help: "Required for follow-up outcome review.",
    accept: "image/*",
  },
  {
    key: "img_followup_top",
    title: "Follow-up Top",
    min: 0,
    max: 3,
    required: false,
    help: "Required for follow-up outcome review.",
    accept: "image/*",
  },
  {
    key: "img_followup_crown",
    title: "Follow-up Crown",
    min: 0,
    max: 3,
    required: false,
    help: "Required when crown outcomes are assessed.",
    accept: "image/*",
  },
  {
    key: "img_followup_donor",
    title: "Follow-up Donor",
    min: 0,
    max: 3,
    required: false,
    help: "Required for donor healing review.",
    accept: "image/*",
  },
  { key: "img_trichoscopy", title: "Trichoscopy Images", min: 0, max: 10, required: false, accept: "image/*" },
  {
    key: "file_operative_notes",
    title: "Operative Notes Upload",
    min: 0,
    max: 1,
    required: false,
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    key: "file_case_records",
    title: "Consent / Case Records",
    min: 0,
    max: 1,
    required: false,
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
];

/* ----- Patient uploader global copy ----- */

export const PATIENT_UPLOADER_REASSURANCE =
  "Don't worry if you can't provide every photo. Just upload what you have. Even 3 clear photos are enough for a meaningful audit.";

export const PATIENT_UPLOADER_TIPS = {
  title: "How to Take Better Photos",
  bullets: [
    "Use bright indoor lighting",
    "Avoid strong shadows",
    "No filters",
    "Keep camera 30–50 cm away",
    "Try to keep angles consistent",
  ],
} as const;
