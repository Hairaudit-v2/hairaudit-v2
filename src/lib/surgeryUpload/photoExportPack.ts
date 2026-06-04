// Stage 8A — ZIP naming, folder layout, and filename sanitisation for surgery photo exports.
import {
  SURGERY_PHOTO_SLOTS,
  isValidSurgerySlot,
  normalizeSurgerySlot,
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

/** CRM / filename-safe patient display name from profile (never raw email/phone). */
export function sanitizePatientDisplayName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.replace(/@/g, " ").trim();
  s = stripRiskyFilenameContent(s);
  return sanitizePathSegment(s, 80);
}

/**
 * Resolve human-facing case reference for filenames (not necessarily the same as patient_reference CSV column).
 */
export function resolveCaseReferenceForExport(args: {
  patientReference: string | null;
  caseTitle: string | null;
  shortCaseId: string;
}): string {
  const pr = args.patientReference?.trim();
  if (pr) return stripRiskyFilenameContent(pr);
  const t = args.caseTitle?.trim();
  if (t) return stripRiskyFilenameContent(t);
  return args.shortCaseId;
}

export function buildZipDisplayName(args: {
  /** Profile display name when available (Stage 8B). */
  patientName: string;
  caseReference: string;
  surgeryDate: string | null;
  shortCase: string;
}): string {
  const datePart = args.surgeryDate?.trim() || "unknown-date";
  const ref = sanitizePathSegment(stripRiskyFilenameContent(args.caseReference || args.shortCase), 48);
  const nameSeg = args.patientName
    ? sanitizePathSegment(stripRiskyFilenameContent(args.patientName), 36)
    : "";
  if (nameSeg) {
    return `HairAudit-Surgery-Photos-${nameSeg}-${ref}-${datePart}.zip`;
  }
  if (ref && ref !== args.shortCase) {
    return `HairAudit-Surgery-Photos-${ref}-${datePart}.zip`;
  }
  return `HairAudit-Surgery-Photos-${args.shortCase}-${datePart}.zip`;
}

/** ASCII-safe Content-Disposition value (lowercase, tight charset). */
export function buildZipAttachmentFilename(args: {
  patientName: string;
  caseReference: string;
  surgeryDate: string | null;
  shortCase: string;
}): string {
  const datePart = (args.surgeryDate ?? "unknown").replace(/[^\d-]/g, "").slice(0, 10) || "unknown";
  const ref = sanitizePathSegment(
    stripRiskyFilenameContent(args.caseReference || args.shortCase).toLowerCase().replace(/\s+/g, "-"),
    40
  ).replace(/[^a-z0-9._-]/g, "");
  const nameSeg = args.patientName
    ? sanitizePathSegment(
        stripRiskyFilenameContent(args.patientName).toLowerCase().replace(/\s+/g, "-"),
        28
      ).replace(/[^a-z0-9._-]/g, "")
    : "";
  if (nameSeg) return `hairaudit-surgery-photos-${nameSeg}-${ref}-${datePart}.zip`;
  if (ref) return `hairaudit-surgery-photos-${ref}-${datePart}.zip`;
  return `hairaudit-surgery-photos-${args.shortCase}-${datePart}.zip`;
}

export function buildZipRootFolderName(args: {
  patientName: string;
  caseReference: string;
  shortCase: string;
}): string {
  const ref = sanitizePathSegment(stripRiskyFilenameContent(args.caseReference || args.shortCase), 40);
  const nameSeg = args.patientName
    ? sanitizePathSegment(stripRiskyFilenameContent(args.patientName), 28)
    : "";
  const core = nameSeg ? `Case-${nameSeg}-${ref}` : `Case-${ref}`;
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
  /** When null or empty, include all known surgery_photo slots. */
  slotsFilter: Set<SurgeryPhotoSlotKey> | null
): SurgeryUploadRowForExport[] {
  const list: SurgeryUploadRowForExport[] = [];
  const activeFilter = slotsFilter && slotsFilter.size > 0 ? slotsFilter : null;
  for (const row of rows) {
    const t = String(row.type ?? "");
    if (!t.startsWith("surgery_photo:")) continue;
    const slot = slotFromSurgeryType(t);
    if (!slot) continue;
    if (activeFilter && !activeFilter.has(slot)) continue;
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

/** Count surgery_photo uploads per checklist slot (known slots only). */
export function countSurgeryPhotosBySlot(
  rows: Pick<SurgeryUploadRowForExport, "type">[]
): Map<SurgeryPhotoSlotKey, number> {
  const counts = new Map<SurgeryPhotoSlotKey, number>();
  for (const row of rows) {
    const slot = slotFromSurgeryType(String(row.type ?? ""));
    if (!slot) continue;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  return counts;
}

/**
 * Parse `slot` and `slots` query params. If both are non-empty → error.
 * `slots` is comma-separated slot keys. Returns a set for partial export, or null for all.
 */
export function parsePhotoExportSlotParams(searchParams: URLSearchParams):
  | { ok: true; slots: Set<SurgeryPhotoSlotKey> | null }
  | { ok: false; error: string } {
  const rawSlot = searchParams.get("slot")?.trim() ?? "";
  const rawSlots = searchParams.get("slots")?.trim() ?? "";
  if (rawSlot && rawSlots) {
    return { ok: false, error: "Use either slot or slots, not both." };
  }
  if (rawSlots) {
    const parts = rawSlots
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) {
      return { ok: false, error: "slots must list at least one category." };
    }
    if (parts.length > SURGERY_PHOTO_SLOTS.length) {
      return { ok: false, error: "Too many categories selected." };
    }
    const out = new Set<SurgeryPhotoSlotKey>();
    for (const p of parts) {
      if (!isValidSurgerySlot(p)) {
        return { ok: false, error: `Invalid photo slot: ${p}` };
      }
      out.add(normalizeSurgerySlot(p));
    }
    return { ok: true, slots: out };
  }
  if (rawSlot) {
    if (!isValidSurgerySlot(rawSlot)) {
      return { ok: false, error: "Invalid photo slot." };
    }
    return { ok: true, slots: new Set<SurgeryPhotoSlotKey>([normalizeSurgerySlot(rawSlot)]) };
  }
  return { ok: true, slots: null };
}

export function estimateUploadBytes(meta: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  const o = meta.original_size_bytes;
  const sz = meta.size;
  if (typeof o === "number" && Number.isFinite(o) && o > 0) return o;
  if (typeof sz === "number" && Number.isFinite(sz) && sz > 0) return sz;
  return null;
}
