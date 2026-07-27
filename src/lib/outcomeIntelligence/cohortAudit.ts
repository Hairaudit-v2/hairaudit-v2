/**
 * FI-OUTCOME-INTELLIGENCE-1A — Bounded audit events (no raw patient/case IDs).
 */

export type OutcomeCohortAuditEventType =
  | "cohort_materialization_created"
  | "cohort_materialization_reused"
  | "cohort_source_lineage_superseded"
  | "cohort_backfill_batch_completed"
  | "cohort_deidentification_rejected"
  | "cohort_governance_gate_blocked"
  | "cohort_missing_secret_blocked"
  | "cohort_feature_disabled"
  | "cohort_lineage_rejected";

export type OutcomeCohortAuditEvent = {
  eventType: OutcomeCohortAuditEventType;
  /** Pseudonymous procedure key when available — never raw caseId. */
  cohortProcedureKey: string | null;
  /** Pseudonymous subject key when available — never raw patientId. */
  cohortSubjectKey: string | null;
  rowChecksum: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OutcomeCohortAuditSink = {
  record(event: OutcomeCohortAuditEvent): void | Promise<void>;
};

export class InMemoryOutcomeCohortAuditSink implements OutcomeCohortAuditSink {
  readonly events: OutcomeCohortAuditEvent[] = [];

  record(event: OutcomeCohortAuditEvent): void {
    this.events.push(event);
  }
}

export function createCohortAuditEvent(args: {
  eventType: OutcomeCohortAuditEventType;
  cohortProcedureKey?: string | null;
  cohortSubjectKey?: string | null;
  rowChecksum?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  now?: string;
}): OutcomeCohortAuditEvent {
  return {
    eventType: args.eventType,
    cohortProcedureKey: args.cohortProcedureKey ?? null,
    cohortSubjectKey: args.cohortSubjectKey ?? null,
    rowChecksum: args.rowChecksum ?? null,
    actorId: args.actorId ?? null,
    metadata: args.metadata ?? {},
    createdAt: args.now ?? new Date().toISOString(),
  };
}
