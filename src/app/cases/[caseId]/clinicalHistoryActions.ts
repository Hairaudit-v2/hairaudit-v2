"use server";

import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuditor } from "@/lib/auth/permissions";
import { queueAuditorRerunFromAdmin } from "@/lib/auditor/queueAuditorRerun";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";
import { logClinicalHistoryEvent } from "@/lib/hairaudit/clinical-history/clinicalHistoryAudit";
import {
  buildClinicalHistorySnapshot,
  loadCaseClinicalHistory,
  upsertCaseClinicalHistory,
} from "@/lib/hairaudit/clinical-history/clinicalHistory.server";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

export type SaveClinicalHistoryResult =
  | { ok: true; snapshot: ClinicalHistorySnapshot; created: boolean }
  | { ok: false; error: string };

async function requireAuditorActor(): Promise<
  | { ok: true; userId: string; admin: ReturnType<typeof createSupabaseAdminClient> }
  | { ok: false; error: string }
> {
  const supabaseAuth = await createSupabaseAuthServerClient();
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();
  if (error || !user) return { ok: false, error: "Unauthorized" };

  const auditor = await requireAuditor({ userId: user.id, userEmail: user.email });
  if (!auditor.ok) return { ok: false, error: "Forbidden" };

  return { ok: true, userId: user.id, admin: createSupabaseAdminClient() };
}

export async function saveCaseClinicalHistoryAction(
  caseId: string,
  payload: unknown
): Promise<SaveClinicalHistoryResult> {
  if (!caseId) return { ok: false, error: "Missing caseId" };

  const auth = await requireAuditorActor();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: c } = await auth.admin.from("cases").select("id").eq("id", caseId).maybeSingle();
  if (!c) return { ok: false, error: "Case not found" };

  const result = await upsertCaseClinicalHistory(caseId, payload, auth.userId, auth.admin);
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, snapshot: result.snapshot, created: result.created };
}

export async function saveCaseClinicalHistoryAndRegenerateAction(
  caseId: string,
  payload: unknown
): Promise<SaveClinicalHistoryResult & { rerunLogId?: string; warning?: string }> {
  const saveResult = await saveCaseClinicalHistoryAction(caseId, payload);
  if (!saveResult.ok) return saveResult;

  const auth = await requireAuditorActor();
  if (!auth.ok) return { ok: false, error: auth.error };

  await logClinicalHistoryEvent(auth.admin, {
    caseId,
    actorId: auth.userId,
    eventType: "clinical_history_used_for_regeneration",
    metadata: { action: "regenerate_ai_audit" },
  });

  const rerun = await queueAuditorRerunFromAdmin(auth.admin, {
    caseId,
    actingUserId: auth.userId,
    action: "regenerate_ai_audit",
    reason: "auditor_review_request",
    notes: "Regeneration triggered after structured clinical history save",
  });

  if (!rerun.ok) {
    return {
      ok: true,
      snapshot: saveResult.snapshot,
      created: saveResult.created,
      warning: `Clinical history saved but regeneration failed: ${rerun.error}`,
    };
  }

  return {
    ok: true,
    snapshot: saveResult.snapshot,
    created: saveResult.created,
    rerunLogId: rerun.rerunLogId,
  };
}

export async function saveCaseClinicalHistoryAndRegenerateImageLimitedAction(
  caseId: string,
  payload: unknown
): Promise<SaveClinicalHistoryResult & { rerunLogId?: string; warning?: string }> {
  const saveResult = await saveCaseClinicalHistoryAction(caseId, payload);
  if (!saveResult.ok) return saveResult;

  const auth = await requireAuditorActor();
  if (!auth.ok) return { ok: false, error: auth.error };

  await logClinicalHistoryEvent(auth.admin, {
    caseId,
    actorId: auth.userId,
    eventType: "clinical_history_used_for_image_limited_regeneration",
    metadata: { action: "regenerate_ai_audit", reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED },
  });

  const rerun = await queueAuditorRerunFromAdmin(auth.admin, {
    caseId,
    actingUserId: auth.userId,
    action: "regenerate_ai_audit",
    reason: AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
    notes: "Image-limited regeneration triggered after Clinical Intelligence Editor save",
  });

  if (!rerun.ok) {
    return {
      ok: true,
      snapshot: saveResult.snapshot,
      created: saveResult.created,
      warning: `Clinical history saved but image-limited regeneration failed: ${rerun.error}`,
    };
  }

  return {
    ok: true,
    snapshot: saveResult.snapshot,
    created: saveResult.created,
    rerunLogId: rerun.rerunLogId,
  };
}

export async function loadCaseClinicalHistoryForPanel(caseId: string): Promise<ClinicalHistorySnapshot | null> {
  const auth = await requireAuditorActor();
  if (!auth.ok) return null;

  const row = await loadCaseClinicalHistory(caseId, auth.admin);
  return row ? buildClinicalHistorySnapshot(row) : null;
}
