// HairAudit Mobile Surgery Upload Portal — Stage 4B
// Client-only local recovery for surgery-upload FORM FIELDS. This is a reliability
// convenience for surgery-room phone use (refresh / lock / accidental navigation /
// flaky connection) — NOT offline queueing and NOT a source of truth.
//
// Hard rules:
//  * Only the editable form fields (SURGERY_RECOVERABLE_FIELDS) are ever stored.
//  * NEVER stores image files/blobs, signed URLs, or storage paths.
//  * Data lives in localStorage on this device only and is cleared once the server
//    has confirmed the same values, on submit, or when the user discards it.
//  * Local data NEVER grants access — the server remains authoritative.
import {
  SURGERY_RECOVERABLE_FIELDS,
  type SurgeryUploadDetailsInput,
} from "./fields";

export const LOCAL_DRAFT_VERSION = 1;

const KEY_PREFIX = "hairaudit:surgery-upload-draft";

/** A recoverable value is always a primitive the form produces (or null). */
type RecoverableValue = string | number | boolean | null;

export type LocalSurgeryDraft = {
  version: number;
  caseId: string;
  /** ISO timestamp this device last cached the draft. */
  savedAt: string;
  /** Only the changed editable fields (minimal footprint). */
  values: Partial<SurgeryUploadDetailsInput>;
  /** The server updated_at the local edits were based on (for conflict hints). */
  lastServerUpdatedAt?: string | null;
};

const FIELD_SET = new Set<string>(SURGERY_RECOVERABLE_FIELDS as readonly string[]);

function getStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Private mode / disabled storage — recovery is best-effort.
    return null;
  }
}

/** Storage key, scoped by caseId and (when known) the signed-in user. */
export function getRecoveryKey(caseId: string, userId?: string | null): string {
  const scope = userId ? `:u:${userId}` : "";
  return `${KEY_PREFIX}${scope}:${caseId}`;
}

/** Normalize a value for equality checks: null/undefined/"" all collapse to "". */
function normalizeForCompare(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/** Keep only known editable fields with primitive values; drop everything else. */
function sanitizeValues(raw: unknown): Partial<SurgeryUploadDetailsInput> {
  const out: Record<string, RecoverableValue> = {};
  if (!raw || typeof raw !== "object") return out as Partial<SurgeryUploadDetailsInput>;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!FIELD_SET.has(k)) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out as Partial<SurgeryUploadDetailsInput>;
}

/** Extract the recoverable (editable) subset from a fuller details object. */
export function pickRecoverableValues(
  details: Record<string, unknown>
): Partial<SurgeryUploadDetailsInput> {
  return sanitizeValues(details);
}

/**
 * Build the minimal patch of fields where local differs from server. Empty values
 * ("") normalize to null so they match the server/PATCH contract.
 */
export function diffRecoverableValues(
  local: Partial<SurgeryUploadDetailsInput>,
  server: Partial<SurgeryUploadDetailsInput>
): Partial<SurgeryUploadDetailsInput> {
  const out: Record<string, RecoverableValue> = {};
  for (const key of SURGERY_RECOVERABLE_FIELDS) {
    const lv = (local as Record<string, unknown>)[key];
    const sv = (server as Record<string, unknown>)[key];
    if (normalizeForCompare(lv) !== normalizeForCompare(sv)) {
      out[key] = lv === "" || lv === undefined ? null : (lv as RecoverableValue);
    }
  }
  return out as Partial<SurgeryUploadDetailsInput>;
}

/**
 * True when the locally-stored values meaningfully differ from the server values.
 * Iterates the local keys only (local is the minimal changed set).
 */
export function hasMeaningfulLocalDifferences(
  localValues: Partial<SurgeryUploadDetailsInput>,
  serverValues: Partial<SurgeryUploadDetailsInput>
): boolean {
  const local = localValues as Record<string, unknown>;
  const server = serverValues as Record<string, unknown>;
  for (const key of Object.keys(local)) {
    if (!FIELD_SET.has(key)) continue;
    if (normalizeForCompare(local[key]) !== normalizeForCompare(server[key])) return true;
  }
  return false;
}

/** Load + validate the cached draft for a case. Returns null when absent/invalid. */
export function loadLocalSurgeryDraft(
  caseId: string,
  userId?: string | null
): LocalSurgeryDraft | null {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(getRecoveryKey(caseId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    // Version + identity guards: ignore stale schemas and mismatched cases.
    if (obj.version !== LOCAL_DRAFT_VERSION) return null;
    if (obj.caseId !== caseId) return null;
    if (typeof obj.savedAt !== "string") return null;
    const values = sanitizeValues(obj.values);
    if (Object.keys(values).length === 0) return null;
    const lastServerUpdatedAt =
      typeof obj.lastServerUpdatedAt === "string" ? obj.lastServerUpdatedAt : null;
    return {
      version: LOCAL_DRAFT_VERSION,
      caseId,
      savedAt: obj.savedAt,
      values,
      lastServerUpdatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Persist the changed editable fields for a case. Storing an empty set clears the
 * cache instead (nothing meaningful to recover).
 */
export function saveLocalSurgeryDraft(
  caseId: string,
  values: Partial<SurgeryUploadDetailsInput>,
  userId?: string | null,
  lastServerUpdatedAt?: string | null
): void {
  const store = getStore();
  if (!store) return;
  const clean = sanitizeValues(values);
  if (Object.keys(clean).length === 0) {
    clearLocalSurgeryDraft(caseId, userId);
    return;
  }
  const payload: LocalSurgeryDraft = {
    version: LOCAL_DRAFT_VERSION,
    caseId,
    savedAt: new Date().toISOString(),
    values: clean,
    lastServerUpdatedAt: lastServerUpdatedAt ?? null,
  };
  try {
    store.setItem(getRecoveryKey(caseId, userId), JSON.stringify(payload));
  } catch {
    // Quota exceeded / disabled — best-effort only.
  }
}

/** Remove any cached draft for a case (after confirmed save, submit, or discard). */
export function clearLocalSurgeryDraft(caseId: string, userId?: string | null): void {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(getRecoveryKey(caseId, userId));
  } catch {
    // ignore
  }
}
