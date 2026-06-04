// HairAudit Mobile Surgery Upload Portal — Stage 6A
// Read-only loader + view-model builder for the evidence-review event history that
// Stage 5 records in surgery_upload_evidence_events.
//
// Design / safety notes:
//  * This module is server+client safe: it only imports TYPES from supabase-js and
//    pure helpers from evidenceReview/checklist. The DB client is always passed in.
//  * Access control is the CALLER's responsibility: callers must verify case access
//    before invoking loadEvidenceEvents (both surgery-upload server pages already do
//    this via canAccessCase). RLS on surgery_upload_evidence_events is the backstop.
//  * The loader returns fully-sanitized view models — raw metadata JSON is NEVER
//    forwarded to the UI. Only a small allow-list of known fields is read.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SURGERY_PHOTO_SLOTS } from "@/lib/surgeryUpload/checklist";
import {
  evidenceReviewStatusLabel,
  slotReviewStatusLabel,
} from "@/lib/surgeryUpload/evidenceReview";
import {
  auditIntakePriorityLabel,
  auditIntakeStatusLabel,
} from "@/lib/surgeryUpload/auditIntake";
import type { EvidenceEventType } from "@/lib/surgeryUpload/logEvidenceEvent";

/** Max characters of free-text (notes / request messages) surfaced in the timeline. */
const MAX_TIMELINE_TEXT = 600;

const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.label])
);

/** Human-friendly label for a photo slot key (falls back to the raw key). */
export function surgerySlotLabel(slotKey: unknown): string {
  if (typeof slotKey !== "string" || slotKey.trim() === "") return "a photo category";
  return SLOT_LABELS[slotKey] ?? slotKey;
}

// ---------------------------------------------------------------------------
// Event labels
// ---------------------------------------------------------------------------
export const EVIDENCE_EVENT_LABELS: Record<EvidenceEventType, string> = {
  evidence_review_status_changed: "Evidence review status changed",
  slot_review_updated: "Photo category review updated",
  additional_evidence_uploaded: "Additional evidence uploaded",
  evidence_resubmitted: "Additional evidence resubmitted",
  audit_handoff: "Audit handoff",
  audit_intake_created: "Audit intake created",
  audit_intake_updated: "Audit intake updated",
  audit_intake_status_changed: "Audit intake status changed",
  "surgery-upload/report-requested": "Evidence review report requested",
  "surgery-upload/report-completed": "Evidence review report completed",
  "surgery-upload/report-failed": "Evidence review report failed",
  photo_export_created: "Surgery photos exported",
  photo_export_failed: "Photo export failed",
};

/** Label for a known event type; unknown types render as a safe generic label. */
export function evidenceEventLabel(eventType: unknown): string {
  if (typeof eventType === "string" && eventType in EVIDENCE_EVENT_LABELS) {
    return EVIDENCE_EVENT_LABELS[eventType as EvidenceEventType];
  }
  return "Evidence event";
}

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------
/** A sanitized, render-ready timeline entry. Contains no raw metadata JSON. */
export type EvidenceTimelineEvent = {
  id: string;
  eventType: string;
  label: string;
  /** One-line, human-friendly summary of what happened. */
  summary: string;
  /** Optional reviewer note / request message, bounded and safe to display. */
  note: string | null;
  /** Display name for who performed the action ("Reviewer", "Clinic user", …). */
  actorLabel: string;
  createdAt: string;
};

type RawEventRow = {
  id: string;
  case_id: string;
  actor_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Metadata reading (allow-list only)
// ---------------------------------------------------------------------------
function readString(meta: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim().slice(0, MAX_TIMELINE_TEXT);
  }
  return null;
}

function readNumber(meta: Record<string, unknown> | null, ...keys: string[]): number | null {
  if (!meta) return null;
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function readBool(meta: Record<string, unknown> | null, key: string): boolean {
  return !!(meta && meta[key] === true);
}

function photosLabel(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

/** Build the summary + optional note for one event from its sanitized metadata. */
function buildSummary(
  eventType: string,
  meta: Record<string, unknown> | null
): { summary: string; note: string | null } {
  switch (eventType) {
    case "evidence_review_status_changed": {
      const from = readString(meta, "from", "previousStatus");
      const to = readString(meta, "to", "newStatus", "status");
      const summary =
        from || to
          ? `Evidence status changed from ${evidenceReviewStatusLabel(from)} to ${evidenceReviewStatusLabel(to)}.`
          : "Evidence review status changed.";
      // Prefer the request message (needs-more-evidence flow); fall back to notes.
      // Older Stage 5 events only stored has* booleans, so the text may be absent.
      const note =
        readString(meta, "requestMessage", "reviewerNotes") ??
        (readBool(meta, "hasRequestMessage")
          ? "A request message was included."
          : readBool(meta, "hasNotes")
            ? "Reviewer notes were included."
            : null);
      return { summary, note };
    }
    case "slot_review_updated": {
      const slot = surgerySlotLabel(readString(meta, "slotKey", "slot"));
      const status = readString(meta, "status");
      const summary = status
        ? `${slot} marked as ${slotReviewStatusLabel(status)}.`
        : `${slot} review updated.`;
      return { summary, note: readString(meta, "reviewerNotes") };
    }
    case "additional_evidence_uploaded": {
      const slotRaw = readString(meta, "slot", "slotKey");
      const count = readNumber(meta, "count", "uploadedCount");
      if (slotRaw) {
        const slot = surgerySlotLabel(slotRaw);
        const summary =
          count != null
            ? `Additional evidence uploaded to ${slot} (${photosLabel(count)}).`
            : `Additional evidence uploaded to ${slot}.`;
        return { summary, note: null };
      }
      const summary =
        count != null
          ? `Additional evidence uploaded (${photosLabel(count)}).`
          : "Additional evidence uploaded.";
      return { summary, note: null };
    }
    case "evidence_resubmitted":
      return { summary: "Additional evidence resubmitted for review.", note: null };
    case "audit_handoff": {
      const result = readString(meta, "result");
      const mode = readString(meta, "pipelineMode");
      if (result === "failed") {
        return {
          summary: "Audit handoff failed.",
          note: readString(meta, "errorMessage"),
        };
      }
      // Stage 6B was marker mode; Stage 6C sends to the audit intake queue.
      const summary =
        mode === "marker"
          ? "Mobile surgery upload marked for audit intake."
          : "Mobile surgery upload sent to audit intake.";
      return { summary, note: readString(meta, "notes") };
    }
    case "audit_intake_created":
      return { summary: "Audit intake record created.", note: null };
    case "audit_intake_status_changed": {
      const from = readString(meta, "from", "previousStatus");
      const to = readString(meta, "to", "newStatus", "status");
      const summary =
        from || to
          ? `Audit intake status changed from ${auditIntakeStatusLabel(from)} to ${auditIntakeStatusLabel(to)}.`
          : "Audit intake status changed.";
      return { summary, note: null };
    }
    case "audit_intake_updated": {
      const priorityTo = readString(meta, "priority", "priorityChangedTo");
      if (priorityTo) {
        return {
          summary: `Audit intake priority changed to ${auditIntakePriorityLabel(priorityTo)}.`,
          note: null,
        };
      }
      if (readBool(meta, "assignedChanged")) {
        return {
          summary: readBool(meta, "assigned")
            ? "Audit intake assigned to a reviewer."
            : "Audit intake assignment cleared.",
          note: null,
        };
      }
      if (readBool(meta, "notesUpdated")) {
        return { summary: "Audit intake notes updated.", note: null };
      }
      return { summary: "Audit intake record updated.", note: null };
    }
    case "surgery-upload/report-requested": {
      const rt = readString(meta, "reportType");
      return {
        summary: "Non-AI evidence review report was requested (background job).",
        note: rt ? `Type: ${rt}` : null,
      };
    }
    case "surgery-upload/report-completed":
      return {
        summary: "Evidence review PDF generated.",
        note: readString(meta, "pdfPath"),
      };
    case "surgery-upload/report-failed":
      return {
        summary: "Evidence review report generation failed.",
        note: readString(meta, "error"),
      };
    case "photo_export_created": {
      const count = readNumber(meta, "photoCount", "count");
      const scope = readString(meta, "scope");
      const slotKey = readString(meta, "slotKey");
      const skipped = readNumber(meta, "skippedCount");
      const scopeLabel =
        scope === "slot" && slotKey ? `category “${surgerySlotLabel(slotKey)}”` : "all categories";
      const summary =
        count != null
          ? skipped != null && skipped > 0
            ? `Surgery photos exported (${count} file${count === 1 ? "" : "s"}, ${scopeLabel}; ${skipped} missing from storage).`
            : `Surgery photos exported (${count} file${count === 1 ? "" : "s"}, ${scopeLabel}).`
          : `Surgery photos exported (${scopeLabel}).`;
      return { summary, note: null };
    }
    case "photo_export_failed":
      return {
        summary: "Photo export failed.",
        note: readString(meta, "message", "errorMessage"),
      };
    default:
      return { summary: "Evidence review activity recorded.", note: null };
  }
}

// ---------------------------------------------------------------------------
// Actor display
// ---------------------------------------------------------------------------
// We only read profiles(id, role, display_name). Email lives in auth.users and is
// intentionally NOT fetched here (avoids per-actor admin lookups). When no profile
// is found we fall back to a role-agnostic, non-identifying label.
function actorLabelFromProfile(profile: { role?: string | null; display_name?: string | null } | undefined): string {
  const name = profile?.display_name?.trim();
  if (name) return name;
  switch (profile?.role) {
    case "auditor":
      return "Reviewer";
    case "clinic":
      return "Clinic user";
    case "doctor":
      return "Doctor";
    default:
      return "User";
  }
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
/**
 * Load sanitized evidence-review events for a case, OLDEST FIRST (story/history
 * order, easiest to follow for audit context).
 *
 * IMPORTANT: the caller MUST have already verified that the current user can access
 * `caseId`. This function does not re-check case access — it trusts the provided db
 * client + the case-access gate already performed by the surgery-upload pages.
 *
 * Best-effort: any failure (missing table in older environments, RLS) yields [].
 */
export async function loadEvidenceEvents(
  db: SupabaseClient,
  caseId: string
): Promise<EvidenceTimelineEvent[]> {
  try {
    const { data, error } = await db
      .from("surgery_upload_evidence_events")
      .select("id, case_id, actor_id, event_type, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    const rows = data as RawEventRow[];
    if (rows.length === 0) return [];

    // Resolve actor display names in one batched query (best-effort).
    const actorIds = Array.from(
      new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))
    );
    const profilesById = new Map<string, { role?: string | null; display_name?: string | null }>();
    if (actorIds.length > 0) {
      try {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, role, display_name")
          .in("id", actorIds);
        for (const p of (profiles ?? []) as Array<{ id: string; role?: string | null; display_name?: string | null }>) {
          profilesById.set(p.id, { role: p.role, display_name: p.display_name });
        }
      } catch {
        // Actor enrichment is non-critical; fall back to generic labels.
      }
    }

    return rows.map((row) => {
      const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : null) as
        | Record<string, unknown>
        | null;
      const { summary, note } = buildSummary(row.event_type, meta);
      return {
        id: row.id,
        eventType: row.event_type,
        label: evidenceEventLabel(row.event_type),
        summary,
        note,
        actorLabel: row.actor_id
          ? actorLabelFromProfile(profilesById.get(row.actor_id))
          : "System",
        createdAt: row.created_at,
      };
    });
  } catch {
    return [];
  }
}
