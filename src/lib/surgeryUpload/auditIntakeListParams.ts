// HairAudit Mobile Surgery Upload Portal — Stage 6C
// Sanitization of the audit-intake queue URL search params. Everything that flows
// into a server-side query passes through here first so raw user input never
// reaches the query builder unchecked. Mirrors listParams.ts (Stage 4A).
import { isValidProcedureType } from "./fields";
import {
  isAuditIntakePriority,
  isAuditIntakeStatus,
  type AuditIntakePriority,
  type AuditIntakeStatus,
} from "./auditIntake";

export const AUDIT_INTAKE_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_AUDIT_INTAKE_PAGE_SIZE = 25;

export const MAX_INTAKE_SEARCH_LENGTH = 120;
export const MAX_INTAKE_CLINIC_NAME_FILTER_LENGTH = 200;

export const UNKNOWN_CLINIC_KEY = "__unknown__";

/** "all" means every status; otherwise a valid AuditIntakeStatus. */
export type IntakeStatusFilter = "all" | AuditIntakeStatus;
/** "" means every priority; otherwise a valid AuditIntakePriority. */
export type IntakePriorityFilter = "" | AuditIntakePriority;

export type AuditIntakeFilters = {
  status: IntakeStatusFilter;
  priority: IntakePriorityFilter;
  /** "" | "id:<uuid>" | "name:<lowercased>" | "__unknown__" */
  clinic: string;
  /** "" | "<uuid>" | "unassigned" */
  assignedTo: string;
  /** "" or a valid procedure type. */
  procedure: string;
  /** Trimmed, length-limited free text matched against surgeon / case reference. */
  search: string;
  /** Inclusive YYYY-MM-DD created_at lower bound, or null. */
  from: string | null;
  /** Inclusive YYYY-MM-DD created_at upper bound, or null. */
  to: string | null;
};

export type AuditIntakeQueryParams = AuditIntakeFilters & {
  page: number;
  pageSize: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function sanitizeDate(raw: string): string | null {
  const v = raw.trim();
  if (!DATE_RE.test(v)) return null;
  const ts = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(ts)) return null;
  const roundTrip = new Date(ts).toISOString().slice(0, 10);
  return roundTrip === v ? v : null;
}

function sanitizeClinic(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v === UNKNOWN_CLINIC_KEY) return UNKNOWN_CLINIC_KEY;
  if (v.startsWith("id:")) {
    const id = v.slice(3);
    return UUID_RE.test(id) ? `id:${id.toLowerCase()}` : "";
  }
  if (v.startsWith("name:")) {
    const name = v.slice(5).slice(0, MAX_INTAKE_CLINIC_NAME_FILTER_LENGTH).trim().toLowerCase();
    return name ? `name:${name}` : "";
  }
  return "";
}

function sanitizeAssignedTo(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v === "unassigned") return "unassigned";
  return UUID_RE.test(v) ? v.toLowerCase() : "";
}

export function parseAuditIntakeSearchParams(
  raw: RawSearchParams
): AuditIntakeQueryParams {
  const statusRaw = firstValue(raw.status).trim();
  const status: IntakeStatusFilter = isAuditIntakeStatus(statusRaw) ? statusRaw : "all";

  const priorityRaw = firstValue(raw.priority).trim();
  const priority: IntakePriorityFilter = isAuditIntakePriority(priorityRaw) ? priorityRaw : "";

  const clinic = sanitizeClinic(firstValue(raw.clinic));
  const assignedTo = sanitizeAssignedTo(firstValue(raw.assignedTo));

  const procedureRaw = firstValue(raw.procedure).trim();
  const procedure = isValidProcedureType(procedureRaw) ? procedureRaw : "";

  const search = firstValue(raw.search).trim().slice(0, MAX_INTAKE_SEARCH_LENGTH);

  const from = sanitizeDate(firstValue(raw.from));
  const to = sanitizeDate(firstValue(raw.to));

  const pageSizeRaw = Number(firstValue(raw.pageSize));
  const pageSize = (AUDIT_INTAKE_PAGE_SIZES as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_AUDIT_INTAKE_PAGE_SIZE;

  const pageRaw = Math.floor(Number(firstValue(raw.page)));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  return {
    status,
    priority,
    clinic,
    assignedTo,
    procedure,
    search,
    from,
    to,
    page,
    pageSize,
  };
}

export function hasActiveAuditIntakeFilters(f: AuditIntakeFilters): boolean {
  return (
    f.status !== "all" ||
    Boolean(f.priority) ||
    Boolean(f.clinic) ||
    Boolean(f.assignedTo) ||
    Boolean(f.procedure) ||
    Boolean(f.search) ||
    Boolean(f.from) ||
    Boolean(f.to)
  );
}

export type { AuditIntakePriority, AuditIntakeStatus };
