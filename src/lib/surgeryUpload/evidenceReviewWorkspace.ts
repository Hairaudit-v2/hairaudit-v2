/**
 * Stage 8 — Surgery upload evidence review workspace (grouping, checklist, readiness).
 * Display-only readiness does not gate the Stage 7B report request; server rules remain canonical.
 */
import type { SurgeryPhotoSlotKey } from "@/lib/surgeryUpload/checklist";
import { slotFromSurgeryType } from "@/lib/surgeryUpload/checklist";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";

export const EVIDENCE_WORKSPACE_CATEGORY_ORDER = [
  "preop_baseline",
  "donor_extraction",
  "recipient_implantation",
  "hairline_design",
  "graft_handling_quality",
  "postop_immediate",
  "consent_documentation",
  "uncategorised",
] as const;

export type EvidenceWorkspaceCategoryId = (typeof EVIDENCE_WORKSPACE_CATEGORY_ORDER)[number];

export const EVIDENCE_WORKSPACE_CATEGORY_LABEL: Record<EvidenceWorkspaceCategoryId, string> = {
  preop_baseline: "Pre-op / baseline",
  donor_extraction: "Donor extraction",
  recipient_implantation: "Recipient implantation",
  hairline_design: "Hairline design",
  graft_handling_quality: "Graft handling / graft quality",
  postop_immediate: "Post-op / immediate result",
  consent_documentation: "Consent / documentation",
  uncategorised: "Uncategorised",
};

export type EvidenceWorkspaceUploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: unknown;
  created_at: string;
};

/** Map checklist slot → high-level workspace category (for reviewer grouping). */
export function surgerySlotToWorkspaceCategory(slot: SurgeryPhotoSlotKey): EvidenceWorkspaceCategoryId {
  switch (slot) {
    case "preop_donor":
    case "preop_recipient":
      return "preop_baseline";
    case "extraction_progress":
      return "donor_extraction";
    case "implantation_progress":
      return "recipient_implantation";
    case "hairline_design":
      return "hairline_design";
    case "graft_quality":
    case "petri_graft_sorting":
      return "graft_handling_quality";
    case "postop_donor":
    case "postop_recipient":
      return "postop_immediate";
    case "complication":
    case "other":
      return "uncategorised";
    default:
      return "uncategorised";
  }
}

function looksLikeConsentOrDocumentUpload(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes("consent") ||
    t.includes("document") ||
    t.includes("pdf") ||
    t.includes("signature")
  );
}

/**
 * Assign each upload to a workspace category using slot metadata when present,
 * otherwise heuristics for non–surgery-photo types.
 */
export function evidenceWorkspaceCategoryForUpload(upload: EvidenceWorkspaceUploadRow): EvidenceWorkspaceCategoryId {
  const slot = slotFromSurgeryType(upload.type);
  if (slot) {
    if (slot === "other") {
      const meta = upload.metadata && typeof upload.metadata === "object" ? (upload.metadata as Record<string, unknown>) : {};
      const cat = meta.evidence_workspace_category;
      if (cat === "consent_documentation") return "consent_documentation";
      if (typeof cat === "string" && EVIDENCE_WORKSPACE_CATEGORY_ORDER.includes(cat as EvidenceWorkspaceCategoryId)) {
        return cat as EvidenceWorkspaceCategoryId;
      }
    }
    return surgerySlotToWorkspaceCategory(slot);
  }
  if (looksLikeConsentOrDocumentUpload(upload.type)) return "consent_documentation";
  return "uncategorised";
}

export function groupUploadsByEvidenceWorkspaceCategory(
  uploads: ReadonlyArray<EvidenceWorkspaceUploadRow>
): Record<EvidenceWorkspaceCategoryId, EvidenceWorkspaceUploadRow[]> {
  const out = {} as Record<EvidenceWorkspaceCategoryId, EvidenceWorkspaceUploadRow[]>;
  for (const id of EVIDENCE_WORKSPACE_CATEGORY_ORDER) out[id] = [];
  for (const u of uploads) {
    const cat = evidenceWorkspaceCategoryForUpload(u);
    out[cat].push(u);
  }
  return out;
}

export type EvidenceCompletenessItemId =
  | "procedure_date"
  | "clinic"
  | "doctor"
  | "graft_count"
  | "extraction_method"
  | "implantation_method"
  | "punch_size_if_captured"
  | "donor_photos"
  | "recipient_photos"
  | "hairline_photos"
  | "immediate_postop_photos"
  | "consent_if_applicable";

export type EvidenceCompletenessItem = {
  id: EvidenceCompletenessItemId;
  label: string;
  /** When true, this row counts toward the headline completeness ratio. */
  countsTowardRatio: boolean;
  met: boolean;
};

function hasSlotPhoto(
  uploads: ReadonlyArray<EvidenceWorkspaceUploadRow>,
  slot: SurgeryPhotoSlotKey,
  minCount = 1
): boolean {
  const exactType = `surgery_photo:${slot}`;
  const n = uploads.filter((u) => u.type === exactType).length;
  return n >= minCount;
}

/**
 * Administrative completeness checklist (derived; not persisted).
 * `punch_size_if_captured` does not count toward the headline ratio (optional capture).
 */
export function buildEvidenceCompletenessChecklist(
  details: Pick<
    SurgeryUploadDetails,
    | "surgery_date"
    | "clinic_name"
    | "surgeon_name"
    | "actual_grafts"
    | "planned_grafts"
    | "extraction_machine"
    | "implantation_method"
    | "punch_size"
  >,
  uploads: ReadonlyArray<EvidenceWorkspaceUploadRow>
): EvidenceCompletenessItem[] {
  const graftOk =
    (details.actual_grafts != null && details.actual_grafts > 0) ||
    (details.planned_grafts != null && details.planned_grafts > 0);

  const punchTrim = (details.punch_size ?? "").trim();
  const punchMet = punchTrim.length > 0;

  const donorOk = hasSlotPhoto(uploads, "preop_donor") || hasSlotPhoto(uploads, "postop_donor");
  const recipientOk = hasSlotPhoto(uploads, "preop_recipient") || hasSlotPhoto(uploads, "postop_recipient");
  const hairlineOk = hasSlotPhoto(uploads, "hairline_design");
  const postopOk = hasSlotPhoto(uploads, "postop_donor") && hasSlotPhoto(uploads, "postop_recipient");
  // If there are document-looking uploads, require at least one file in the consent/doc grouping.
  const consentApplicable = uploads.some((u) => looksLikeConsentOrDocumentUpload(u.type));

  const items: EvidenceCompletenessItem[] = [
    {
      id: "procedure_date",
      label: "Procedure date present",
      countsTowardRatio: true,
      met: Boolean(details.surgery_date && String(details.surgery_date).trim()),
    },
    {
      id: "clinic",
      label: "Clinic present",
      countsTowardRatio: true,
      met: Boolean(details.clinic_name && details.clinic_name.trim()),
    },
    {
      id: "doctor",
      label: "Doctor present",
      countsTowardRatio: true,
      met: Boolean(details.surgeon_name && details.surgeon_name.trim()),
    },
    {
      id: "graft_count",
      label: "Graft count present",
      countsTowardRatio: true,
      met: graftOk,
    },
    {
      id: "extraction_method",
      label: "Extraction method / device present",
      countsTowardRatio: true,
      met: Boolean(details.extraction_machine && details.extraction_machine.trim()),
    },
    {
      id: "implantation_method",
      label: "Implantation method present",
      countsTowardRatio: true,
      met: Boolean(details.implantation_method && details.implantation_method.trim()),
    },
    {
      id: "punch_size_if_captured",
      label: "Punch size recorded (optional)",
      countsTowardRatio: false,
      met: punchMet,
    },
    {
      id: "donor_photos",
      label: "Donor area photos present",
      countsTowardRatio: true,
      met: donorOk,
    },
    {
      id: "recipient_photos",
      label: "Recipient area photos present",
      countsTowardRatio: true,
      met: recipientOk,
    },
    {
      id: "hairline_photos",
      label: "Hairline / design photos present",
      countsTowardRatio: true,
      met: hairlineOk,
    },
    {
      id: "immediate_postop_photos",
      label: "Immediate post-op donor & recipient photos present",
      countsTowardRatio: true,
      met: postopOk,
    },
    {
      id: "consent_if_applicable",
      label: "Consent / documentation present (when applicable)",
      countsTowardRatio: true,
      met:
        !consentApplicable ||
        uploads.some((u) => evidenceWorkspaceCategoryForUpload(u) === "consent_documentation"),
    },
  ];

  return items;
}

export function evidenceCompletenessRatio(items: ReadonlyArray<EvidenceCompletenessItem>): { met: number; total: number } {
  const counted = items.filter((i) => i.countsTowardRatio);
  return {
    met: counted.filter((i) => i.met).length,
    total: counted.length,
  };
}

export const EVIDENCE_ISSUE_FLAG_CODES = [
  "missing_donor_photos",
  "missing_recipient_photos",
  "missing_graft_count",
  "poor_image_quality",
  "incomplete_clinic_doctor_details",
  "inconsistent_procedure_metadata",
  "other",
] as const;

export type EvidenceIssueFlagCode = (typeof EVIDENCE_ISSUE_FLAG_CODES)[number];

const FLAG_CODE_SET = new Set<string>(EVIDENCE_ISSUE_FLAG_CODES);

export type EvidenceIssueFlagRow = {
  code: EvidenceIssueFlagCode;
  detail?: string;
};

export function evidenceIssueFlagLabel(code: EvidenceIssueFlagCode): string {
  switch (code) {
    case "missing_donor_photos":
      return "Missing donor photos";
    case "missing_recipient_photos":
      return "Missing recipient photos";
    case "missing_graft_count":
      return "Missing graft count";
    case "poor_image_quality":
      return "Poor image quality";
    case "incomplete_clinic_doctor_details":
      return "Incomplete clinic/doctor details";
    case "inconsistent_procedure_metadata":
      return "Inconsistent procedure metadata";
    case "other":
      return "Other";
    default:
      return code;
  }
}

export function parseEvidenceWorkspaceFlagsJson(raw: unknown): EvidenceIssueFlagRow[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidenceIssueFlagRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const code = (entry as { code?: unknown }).code;
    if (typeof code !== "string" || !FLAG_CODE_SET.has(code)) continue;
    const detail = (entry as { detail?: unknown }).detail;
    const row: EvidenceIssueFlagRow = {
      code: code as EvidenceIssueFlagCode,
      detail: typeof detail === "string" ? detail.slice(0, 500) : undefined,
    };
    const idx = out.findIndex((r) => r.code === row.code);
    if (idx >= 0) out[idx] = row;
    else out.push(row);
  }
  return out;
}

export type WorkspacePatchValidation =
  | { ok: true; notes: string | null; flags: EvidenceIssueFlagRow[] }
  | { ok: false; error: string };

const MAX_NOTES = 8000;
const MAX_FLAGS = 20;

function parseNotesField(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "notes must be a string" };
  const t = raw.trim();
  return { ok: true, value: t === "" ? null : t.slice(0, MAX_NOTES) };
}

function parseFlagsField(raw: unknown): { ok: true; value: EvidenceIssueFlagRow[] } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "flags must be an array" };
  const parsed = parseEvidenceWorkspaceFlagsJson(raw);
  if (parsed.length > MAX_FLAGS) return { ok: false, error: `At most ${MAX_FLAGS} flags` };
  for (const row of parsed) {
    if (row.code === "other" && !(row.detail && row.detail.trim())) {
      return { ok: false, error: 'Flag "other" requires a short detail string' };
    }
  }
  return { ok: true, value: parsed };
}

/**
 * Merge PATCH body with existing row values. At least one of `notes` or `flags` must appear in the body.
 */
export function mergeEvidenceWorkspacePatch(
  body: Record<string, unknown>,
  existingNotes: string | null,
  existingFlags: EvidenceIssueFlagRow[]
): WorkspacePatchValidation {
  if (!("notes" in body) && !("flags" in body)) {
    return { ok: false, error: "Provide notes and/or flags" };
  }
  let nextNotes = existingNotes;
  if ("notes" in body) {
    const n = parseNotesField(body.notes);
    if (!n.ok) return n;
    nextNotes = n.value;
  }
  let nextFlags = existingFlags;
  if ("flags" in body) {
    const f = parseFlagsField(body.flags);
    if (!f.ok) return f;
    nextFlags = f.value;
  }
  return { ok: true, notes: nextNotes, flags: nextFlags };
}

export type EvidenceReportReadinessKind =
  | "report_completed"
  | "report_requested"
  | "ready_for_evidence_report"
  | "needs_more_evidence";

export type EvidenceReportReadiness = {
  kind: EvidenceReportReadinessKind;
  headline: string;
  detail?: string;
};

/**
 * UI-only readiness (does not change Stage 7B request gating).
 */
export function deriveEvidenceReportReadiness(args: {
  pipelineStatus: string | null | undefined;
  checklistItems: ReadonlyArray<EvidenceCompletenessItem>;
  flags: ReadonlyArray<EvidenceIssueFlagRow>;
}): EvidenceReportReadiness {
  const pipeline = (args.pipelineStatus ?? "not_started").trim() || "not_started";

  if (pipeline === "succeeded") {
    return {
      kind: "report_completed",
      headline: "Report completed",
      detail: "Non-AI evidence review PDF has been generated.",
    };
  }

  if (pipeline === "queued" || pipeline === "running") {
    return {
      kind: "report_requested",
      headline: "Report already requested",
      detail: "Generation is queued or in progress.",
    };
  }

  if (pipeline === "failed") {
    return {
      kind: "report_requested",
      headline: "Report already requested",
      detail: "Last generation failed — you can retry from the report panel without changing case submission.",
    };
  }

  if (pipeline === "cancelled") {
    return {
      kind: "report_requested",
      headline: "Report already requested",
      detail: "A report run was cancelled.",
    };
  }

  const { met, total } = evidenceCompletenessRatio(args.checklistItems);
  const ratioOk = total === 0 || met === total;
  const hasFlags = args.flags.length > 0;

  if (ratioOk && !hasFlags) {
    return {
      kind: "ready_for_evidence_report",
      headline: "Ready for evidence report",
      detail: "Administrative checklist satisfied and no workspace flags recorded.",
    };
  }

  return {
    kind: "needs_more_evidence",
    headline: "Needs more evidence",
    detail: hasFlags
      ? "One or more evidence issues are flagged — review before requesting the PDF."
      : `Checklist: ${met}/${total} administrative items satisfied.`,
  };
}

export function workspaceFlagsToJsonb(flags: EvidenceIssueFlagRow[]): unknown {
  return flags.map((f) => ({ code: f.code, ...(f.detail ? { detail: f.detail } : {}) }));
}
