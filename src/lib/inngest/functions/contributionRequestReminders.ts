import { inngest } from "@/lib/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CONTRIBUTION_REMINDER_TIMING,
  getContributionRequestById,
  isRequestExpired,
  isRequestTerminalStatus,
  markReminderSent,
  markRequestExpired,
  reminderLinkForRequest,
  requestRecipients,
  shouldSendReminder,
} from "@/lib/transparency/requestLifecycle";
import { sendFinalCourtesyContributionEmail, sendReminderContributionEmail } from "@/lib/transparency/emails";

function supabaseAdmin() {
  return createSupabaseAdminClient();
}

type ContributionRequestCreatedEvent = {
  requestId: string;
  caseId: string;
  clinicProfileId: string | null;
  doctorProfileId: string | null;
  clinicEmail: string | null;
  doctorEmail: string | null;
  currentStatus: string;
  createdAt: string;
};

export const contributionRequestReminders = inngest.createFunction(
  { id: "contribution-request-reminders", retries: 1 },
  { event: "contribution-request/created" },
  async ({ event, step, logger }) => {
    const data = event.data as ContributionRequestCreatedEvent;
    const requestId = String(data.requestId ?? "");
    if (!requestId) {
      logger.warn("contribution reminder workflow skipped: missing requestId");
      return { ok: false, skipped: true, reason: "missing_request_id" };
    }

    const supabase = supabaseAdmin();

    const resolveRequest = async (phase: string) =>
      step.run(`load-request-${phase}`, async () => {
        return await getContributionRequestById(supabase, requestId);
      });

    const evaluateAndExpireIfNeeded = async (phase: string) => {
      const request = await resolveRequest(phase);
      if (!request) {
        logger.info("contribution reminder workflow exit: request missing", { requestId, phase });
        return { request: null, stop: true as const, reason: "missing" };
      }
      if (isRequestTerminalStatus(request.status)) {
        logger.info("contribution reminder workflow exit: terminal status", {
          requestId,
          phase,
          status: request.status,
        });
        return { request, stop: true as const, reason: "terminal" };
      }
      if (isRequestExpired(request)) {
        await step.run(`mark-expired-${phase}`, async () => {
          await markRequestExpired(supabase, requestId);
          await supabase.from("cases").update({ status: "request_expired" }).eq("id", request.case_id);
        });
        await step.run(`emit-expired-${phase}`, async () => {
          await inngest.send({
            name: "contribution-request/expired",
            data: {
              requestId: request.id,
              caseId: request.case_id,
              currentStatus: "request_expired",
              expiredAt: new Date().toISOString(),
            },
          });
        });
        logger.info("contribution reminder workflow exit: request expired", { requestId, phase });
        return { request, stop: true as const, reason: "expired" };
      }
      return { request, stop: false as const, reason: null };
    };

    await step.sleep("wait-before-reminder-1", CONTRIBUTION_REMINDER_TIMING.firstReminderDelay);
    const phaseOne = await evaluateAndExpireIfNeeded("reminder-1");
    if (phaseOne.stop || !phaseOne.request) return { ok: true, stoppedAt: "pre_reminder_1", reason: phaseOne.reason };

    const reminder1Eligible = shouldSendReminder(phaseOne.request, "reminder_1");
    if (reminder1Eligible) {
      const recipients = requestRecipients(phaseOne.request);
      const contributionUrl = reminderLinkForRequest(phaseOne.request);
      if (recipients.length > 0 && contributionUrl) {
        await step.run("send-reminder-1", async () => {
          await sendReminderContributionEmail({
            to: recipients,
            caseId: phaseOne.request.case_id,
            contributionUrl,
            clinicName: phaseOne.request.clinic_name_snapshot,
            doctorName: phaseOne.request.doctor_name_snapshot,
          });
          await markReminderSent(supabase, phaseOne.request.id, "reminder_1", phaseOne.request.reminder_count);
        });
        logger.info("contribution reminder 1 sent", {
          requestId,
          caseId: phaseOne.request.case_id,
          recipients: recipients.length,
        });
      } else {
        logger.warn("contribution reminder 1 skipped: missing recipients or link", { requestId });
      }
    } else {
      logger.info("contribution reminder 1 skipped by guard", { requestId, status: phaseOne.request.status });
    }

    await step.sleep("wait-before-reminder-2", CONTRIBUTION_REMINDER_TIMING.secondReminderDelay);
    const phaseTwo = await evaluateAndExpireIfNeeded("reminder-2");
    if (phaseTwo.stop || !phaseTwo.request) return { ok: true, stoppedAt: "pre_reminder_2", reason: phaseTwo.reason };

    const reminder2Eligible = shouldSendReminder(phaseTwo.request, "reminder_2");
    if (reminder2Eligible) {
      const recipients = requestRecipients(phaseTwo.request);
      const contributionUrl = reminderLinkForRequest(phaseTwo.request);
      if (recipients.length > 0 && contributionUrl) {
        await step.run("send-reminder-2", async () => {
          await sendFinalCourtesyContributionEmail({
            to: recipients,
            caseId: phaseTwo.request.case_id,
            contributionUrl,
            clinicName: phaseTwo.request.clinic_name_snapshot,
            doctorName: phaseTwo.request.doctor_name_snapshot,
          });
          await markReminderSent(supabase, phaseTwo.request.id, "reminder_2", phaseTwo.request.reminder_count);
        });
        logger.info("contribution reminder 2 sent", {
          requestId,
          caseId: phaseTwo.request.case_id,
          recipients: recipients.length,
        });
      } else {
        logger.warn("contribution reminder 2 skipped: missing recipients or link", { requestId });
      }
    } else {
      logger.info("contribution reminder 2 skipped by guard", { requestId, status: phaseTwo.request.status });
    }

    return { ok: true, requestId };
  }
);
