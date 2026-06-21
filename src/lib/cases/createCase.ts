/**
 * Canonical HairAudit **audit** case creation (patient / doctor / clinic dashboards).
 * Surgery-upload draft cases stay in `POST /api/surgery-upload/cases` (details row + different insert shape).
 *
 * @see docs/stage1b-case-creation-consolidation.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitHairAuditEvent } from "@/lib/integrations";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  MISSING_PATIENT_REVIEW_PATHWAY_ERROR,
  parseExplicitPatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

const LOG_PREFIX = "[cases/createCase]";

export type CaseCreationResolvedRole = "patient" | "doctor" | "clinic";

export async function resolveCaseCreationRole(args: {
  admin: SupabaseClient;
  userId: string;
  userMetadata: Record<string, unknown> | undefined;
  /** `dev_role` cookie value; only applied when {@link args.nodeEnv} is `development`. */
  devRoleCookieValue: string | null;
  nodeEnv: string | undefined;
}): Promise<string> {
  let role = args.userMetadata?.role as string | undefined;
  try {
    const { data: profile } = await args.admin.from("profiles").select("role").eq("id", args.userId).maybeSingle();
    if (profile?.role) role = profile.role as string;
  } catch {
    /* profiles may not exist */
  }
  if (args.nodeEnv === "development" && args.devRoleCookieValue) {
    const devRole = args.devRoleCookieValue;
    if (["patient", "doctor", "clinic", "auditor"].includes(devRole)) role = devRole;
  }
  return role ?? "patient";
}

function normalizeRoleToken(raw: string): string {
  return (raw || "patient").trim().toLowerCase();
}

/**
 * Maps stored/metadata role to an insert profile. Unknown roles fall through to **patient**
 * (legacy `/api/cases/create` behaviour). **auditor** is excluded — use other flows.
 */
export function effectiveAuditCaseCreationRole(rawRole: string): CaseCreationResolvedRole | "auditor" {
  const r = normalizeRoleToken(rawRole);
  if (r === "auditor") return "auditor";
  if (r === "doctor") return "doctor";
  if (r === "clinic") return "clinic";
  return "patient";
}

export function buildAuditCaseInsertData(
  userId: string,
  role: CaseCreationResolvedRole,
  patientReviewPathway: PatientReviewPathway = DEFAULT_PATIENT_REVIEW_PATHWAY
): Record<string, unknown> {
  const insertData: Record<string, unknown> = {
    user_id: userId,
    title:
      role === "doctor"
        ? "Doctor audit"
        : role === "clinic"
          ? "Clinic audit"
          : patientReviewPathway === "pre_surgery"
            ? "Pre-Surgery Review"
            : "Patient Audit",
    status: "draft",
    audit_type: role === "doctor" ? "doctor" : role === "clinic" ? "clinic" : "patient",
    submission_channel:
      role === "doctor" ? "doctor_submitted" : role === "clinic" ? "clinic_submitted" : "patient_submitted",
    visibility_scope: role === "patient" ? "public" : "internal",
  };
  if (role === "patient") {
    insertData.patient_id = userId;
    insertData.patient_review_pathway = patientReviewPathway;
  }
  if (role === "doctor") insertData.doctor_id = userId;
  if (role === "clinic") insertData.clinic_id = userId;
  return insertData;
}

export type CreateAuditCaseResult =
  | { ok: true; caseId: string }
  | { ok: false; error: string; status: number; logContext?: Record<string, unknown> };

async function emitCaseCreatedHook(caseId: string, userId: string, auditType: string): Promise<void> {
  await emitHairAuditEvent("hairaudit.case.created", {
    case_id: caseId,
    audit_type: auditType,
    user_id: userId,
    created_at: new Date().toISOString(),
  });
}

/**
 * Inserts a single `cases` row for the standard audit flow and verifies ownership.
 * Call only after the caller has authenticated the user.
 */
export async function createAuditCase(args: {
  admin: SupabaseClient;
  userId: string;
  userMetadata: Record<string, unknown> | undefined;
  devRoleCookieValue: string | null;
  nodeEnv?: string;
  /** HA-DUAL-PATHWAY-1 — only applied for patient role inserts */
  patientReviewPathway?: PatientReviewPathway | unknown;
}): Promise<CreateAuditCaseResult> {
  const nodeEnv = args.nodeEnv ?? process.env.NODE_ENV;
  const rawRole = await resolveCaseCreationRole({
    admin: args.admin,
    userId: args.userId,
    userMetadata: args.userMetadata,
    devRoleCookieValue: args.devRoleCookieValue,
    nodeEnv,
  });

  const eff = effectiveAuditCaseCreationRole(rawRole);
  if (eff === "auditor") {
    console.info(LOG_PREFIX, "reject auditor case create via audit endpoint", { userId: args.userId });
    return { ok: false, error: "Forbidden", status: 403, logContext: { userId: args.userId } };
  }

  const role: CaseCreationResolvedRole = eff;
  const explicitPathway = parseExplicitPatientReviewPathway(args.patientReviewPathway);
  if (role === "patient" && !explicitPathway) {
    return {
      ok: false,
      error: MISSING_PATIENT_REVIEW_PATHWAY_ERROR,
      status: 400,
      logContext: { userId: args.userId },
    };
  }

  const patientReviewPathway = explicitPathway ?? DEFAULT_PATIENT_REVIEW_PATHWAY;
  const insertData = buildAuditCaseInsertData(args.userId, role, patientReviewPathway);

  console.info(LOG_PREFIX, "insert payload summary", {
    userId: args.userId,
    role,
    audit_type: insertData.audit_type,
    patient_review_pathway: insertData.patient_review_pathway ?? null,
    has_user_id: true,
  });

  const { data: insertResult, error: insertError } = await args.admin.from("cases").insert(insertData).select("id").single();

  if (insertError) {
    console.error(LOG_PREFIX, "insert failed", {
      userId: args.userId,
      error: insertError.message,
      code: insertError.code,
      insertPayloadSummary: { role, audit_type: insertData.audit_type },
    });
    return { ok: false, error: insertError.message, status: 500, logContext: { userId: args.userId } };
  }

  const insertedId = insertResult?.id;
  if (insertedId == null || String(insertedId).trim() === "") {
    console.error(LOG_PREFIX, "insert returned no id", { userId: args.userId, insertResult, insertPayloadSummary: { role } });
    return {
      ok: false,
      error: "Case was not created; please try again.",
      status: 500,
      logContext: { userId: args.userId },
    };
  }

  const caseId = String(insertedId);

  const { data: verifyRow, error: verifyError } = await args.admin.from("cases").select("id, user_id").eq("id", caseId).maybeSingle();

  if (verifyError) {
    console.error(LOG_PREFIX, "post-insert verify query failed", { caseId, userId: args.userId, error: verifyError.message });
    return {
      ok: false,
      error: "Case creation could not be verified; please try again.",
      status: 500,
      logContext: { caseId, userId: args.userId },
    };
  }

  if (!verifyRow || verifyRow.user_id !== args.userId) {
    console.error(LOG_PREFIX, "post-insert verify mismatch or missing row", { caseId, userId: args.userId, verifyRow });
    return {
      ok: false,
      error: "Case creation could not be verified; please try again.",
      status: 500,
      logContext: { caseId, userId: args.userId },
    };
  }

  await emitCaseCreatedHook(caseId, args.userId, String(insertData.audit_type ?? "patient"));

  console.info(LOG_PREFIX, "success", { caseId, userId: args.userId });
  return { ok: true, caseId };
}
