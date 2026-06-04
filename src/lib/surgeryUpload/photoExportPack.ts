// Stage 8A — ZIP naming, folder layout, and filename sanitisation for surgery photo exports.
import {
  SURGERY_PHOTO_SLOTS,
  slotFromSurgeryType,
  type SurgeryPhotoSlotKey,
} from "@/lib/surgeryUpload/checklist";

/** Folder names inside the ZIP (matches Stage 8A spec; order follows checklist.ts). */
export const SURGERY_EXPORT_SLOT_DIRECTORIES: Record<SurgeryPhotoSlotKey, string> = {
  preop_donor: "01-pre-op-donor",
  preop_recipient: "02-pre-op-recipient",
  hairline_design: "03-hairline-design",
  graft_quality: "04-graft-quality-sample",
  postop_donor: "05-immediate-post-op-donor",
  postop_recipient: "06-immediate-post-op-recipient",
  extraction_progress: "07-extraction-progress",
  implantation_progress: "08-implantation-progress",
  petri_graft_sorting: "09-petri-graft-sorting",
  complication: "10-complication-concern",
  other: "11-other",
};

const SLOT_ORDER_INDEX = new Map<SurgeryPhotoSlotKey, number>(
  SURGERY_PHOTO_SLOTS.map((s, i) => [s.key, i])
);

export function slotExportOrderIndex(slot: SurgeryPhotoSlotKey): number {
  return SLOT_ORDER_INDEX.get(slot) ?? 99;
}

const TWO_DIGIT = (n: number) => String(n).padStart(2, "0");

/** Readable slot segment for exported filenames, e.g. preop-donor. */
export function slotKeyForFilename(slot: SurgeryPhotoSlotKey): string {
  return slot.replace(/_/g, "-");
}

/** Collapse whitespace, strip slashes and control chars, limit length. */
export function sanitizePathSegment(input: string, maxLen: number): string {
  let s = input
    .replace(/[\u0000-\u001f\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^\.+/, "").replace(/\.+$/, "");
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s || "Case";
}

/**
 * Remove patterns we never want in export filenames (email-like, long digit runs, etc.).
 */
export function stripRiskyFilenameContent(raw: string): string {
  let s = raw.replace(/@/g, "").replace(/[^a-zA-Z0-9\s._-]/g, " ");
  // Long digit sequences (phone / IDs) — keep short numbers (dates).
  s = s.replace(/\d{10,}/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function shortCaseId(caseId: string): string {
  return caseId.replace(/-/g, "").slice(0, 8);
}

export function inferExtension(storagePath: string, mime: string | null): string {
  const fromPath = storagePath.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]{2,5}$/.test(fromPath)) {
    if (fromPath === "jpeg") return "jpg";
    return fromPath;
  }
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("gif")) return "gif";
  return "jpg";
}

/** Timestamp fragment for filenames: 2026-06-04-1432 */
export function compactTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getUTCFullYear();
  const mo = TWO_DIGIT(d.getUTCMonth() + 1);
  const day = TWO_DIGIT(d.getUTCDate());
  const h = TWO_DIGIT(d.getUTCHours());
  const mi = TWO_DIGIT(d.getUTCMinutes());
  return `${y}-${mo}-${day}-${h}${mi}`;
}

export function uploadShortId(uploadId: string): string {
  return uploadId.replace(/-/g, "").slice(0, 6);
}

export function buildExportedImageBasename(args: {
  slot: SurgeryPhotoSlotKey;
  createdAt: string;
  uploadId: string;
  ext: string;
}): string {
  const ord = TWO_DIGIT(slotExportOrderIndex(args.slot) + 1);
  const slotPart = slotKeyForFilename(args.slot);
  const stamp = compactTimestamp(args.createdAt);
  const id = uploadShortId(args.uploadId);
  const base = `${ord}-${slotPart}-${stamp}-${id}.${args.ext}`;
  return base.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
}

export function pickPatientFacingLabel(args: {
  patientReference: string | null;
  caseTitle: string | null;
}): string {
  const ref = args.patientReference?.trim();
  if (ref) return stripRiskyFilenameContent(ref);
  const title = args.caseTitle?.trim();
  if (title) return stripRiskyFilenameContent(title);
  return "";
}

export function buildZipDisplayName(args: {
  patientLabel: string;
  caseReference: string;
  surgeryDate: string | null;
  shortCase: string;
}): string {
  const datePart = args.surgeryDate?.trim() || "unknown-date";
  const ref = sanitizePathSegment(
    stripRiskyFilenameContent(args.caseReference || args.shortCase),
    48
  );
  const nameSeg = args.patientLabel
    ? sanitizePathSegment(stripRiskyFilenameContent(args.patientLabel), 36)
    : "";
  if (nameSeg) {
    return `HairAudit-Surgery-Photos-${nameSeg}-${ref}-${datePart}.zip`;
  }
  return `HairAudit-Surgery-Photos-${ref}-${datePart}.zip`;
}

/** ASCII-safe Content-Disposition value (lowercase, tight charset). */
export function buildZipAttachmentFilename(args: {
  caseReference: string;
  surgeryDate: string | null;
  shortCase: string;
}): string {
  const datePart = (args.surgeryDate ?? "unknown").replace(/[^\d-]/g, "").slice(0, 10) || "unknown";
  const ref = sanitizePathSegment(
    stripRiskyFilenameContent(args.caseReference || args.shortCase).toLowerCase().replace(/\s+/g, "-"),
    40
  ).replace(/[^a-z0-9._-]/g, "");
  return `hairaudit-surgery-photos-${ref}-${datePart}.zip`;
}

export function buildZipRootFolderName(args: {
  patientLabel: string;
  caseReference: string;
  shortCase: string;
}): string {
  const ref = sanitizePathSegment(stripRiskyFilenameContent(args.caseReference || args.shortCase), 40);
  const label = args.patientLabel
    ? sanitizePathSegment(stripRiskyFilenameContent(args.patientLabel), 32)
    : "";
  const core = label ? `Case-${label}-${ref}` : `Case-${ref}`;
  return sanitizePathSegment(`${core}-${args.shortCase}`, 120);
}

export type SurgeryUploadRowForExport = {
  id: string;
  type: string;
  storage_path: string;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function filterSurgeryPhotoExports(
  rows: SurgeryUploadRowForExport[],
  slotFilter: SurgeryPhotoSlotKey | null
): SurgeryUploadRowForExport[] {
  const list: SurgeryUploadRowForExport[] = [];
  for (const row of rows) {
    const t = String(row.type ?? "");
    if (!t.startsWith("surgery_photo:")) continue;
    const slot = slotFromSurgeryType(t);
    if (!slot) continue;
    if (slotFilter && slot !== slotFilter) continue;
    list.push(row);
  }
  list.sort((a, b) => {
    const sa = slotFromSurgeryType(a.type)!;
    const sb = slotFromSurgeryType(b.type)!;
    const oa = slotExportOrderIndex(sa);
    const ob = slotExportOrderIndex(sb);
    if (oa !== ob) return oa - ob;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return list;
}

export function estimateUploadBytes(meta: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  const o = meta.original_size_bytes;
  const sz = meta.size;
  if (typeof o === "number" && Number.isFinite(o) && o > 0) return o;
  if (typeof sz === "number" && Number.isFinite(sz) && sz > 0) return sz;
  return null;
}
