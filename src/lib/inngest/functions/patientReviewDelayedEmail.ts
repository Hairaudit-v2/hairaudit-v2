/**
 * HA-TRUST-4 — Sends delayed reassurance email when patient review extends beyond SLA.
 */

import { inngest } from "@/lib/inngest/client";
import { notifyPatientReviewStillInProgress } from "@/lib/email";
import { PATIENT_REVIEW_DELAYED_EMAIL_THRESHOLD_MINUTES } from "@/lib/patient/patientTrustStatusTranslator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterForensicAuditReports } from "@/lib/reports/forensicReportsFilter";

export const patientReviewDelayedEmail = inngest.createFunction(
  {
    id: "patient-review-delayed-email",
    retries: 2,
    concurrency: { limit: 20 },
  },
  { event: "case/submitted" },
  async ({ event, step, logger }) => {
    const { caseId, userId } = event.data as { caseId: string; userId: string };
    if (!caseId || !userId) {
      return { skipped: true, reason: "missing_ids" };
    }

    await step.sleep(
      "wait-for-sla",
      `${PATIENT_REVIEW_DELAYED_EMAIL_THRESHOLD_MINUTES}m`
    );

    const stillIncomplete = await step.run("check-case-still-incomplete", async () => {
      const supabase = createSupabaseAdminClient();
      const { data: caseRow, error: caseError } = await supabase
        .from("cases")
        .select("id, status, submitted_at")
        .eq("id", caseId)
        .maybeSingle();

      if (caseError || !caseRow) {
        return { send: false, reason: "case_not_found" as const };
      }

      const status = String(caseRow.status ?? "").toLowerCase();
      if (status === "complete" || status === "draft") {
        return { send: false, reason: "case_terminal" as const };
      }

      const { data: reports } = await supabase
        .from("reports")
        .select("id, pdf_path, report_kind, version")
        .eq("case_id", caseId)
        .order("version", { ascending: false });

      const forensicReports = filterForensicAuditReports(reports ?? []);
      const hasPdf = Boolean((forensicReports[0] as { pdf_path?: string } | null)?.pdf_path);
      if (status === "complete" && hasPdf) {
        return { send: false, reason: "report_ready" as const };
      }

      return { send: true, reason: "still_processing" as const };
    });

    if (!stillIncomplete.send) {
      logger.info("Delayed patient reassurance email skipped", {
        caseId,
        reason: stillIncomplete.reason,
      });
      return { sent: false, reason: stillIncomplete.reason };
    }

    const emailResult = await step.run("send-delayed-reassurance-email", async () => {
      const supabase = createSupabaseAdminClient();
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      const email = user?.user?.email;
      if (!email || typeof email !== "string" || !email.trim()) {
        return { sent: false, reason: "no_email" as const };
      }

      const meta = user?.user?.user_metadata as Record<string, unknown> | undefined;
      const firstName = meta?.first_name ?? meta?.name;

      const sent = await notifyPatientReviewStillInProgress({
        to: email.trim(),
        caseId,
        firstName: firstName != null ? String(firstName).trim() || null : null,
      });

      return { sent, reason: sent ? ("sent" as const) : ("send_failed" as const) };
    });

    logger.info("Delayed patient reassurance email", { caseId, ...emailResult });
    return emailResult;
  }
);
