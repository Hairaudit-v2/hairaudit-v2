// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { runAudit, runGraftIntegrityEstimate, runPdfRebuild, auditorRerun } from "@/lib/inngest/functions";
import { patientReviewDelayedEmail } from "@/lib/inngest/functions/patientReviewDelayedEmail";
import { runSurgeryUploadEvidenceReviewReport } from "@/lib/inngest/functions/surgeryUploadEvidenceReviewReport";
import { runFiImageIntelligenceWorker } from "@/lib/inngest/functions/fiImageIntelligenceWorker";
import { contributionRequestReminders } from "@/lib/inngest/functions/contributionRequestReminders";
import { historicalGiiBackfillWorkflow } from "@/lib/inngest/functions/historicalGiiBackfill";
import { longitudinalEngagementDailyScan } from "@/lib/inngest/functions/longitudinalEngagementDailyScan";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runAudit,
    runGraftIntegrityEstimate,
    runPdfRebuild,
    auditorRerun,
    patientReviewDelayedEmail,
    historicalGiiBackfillWorkflow,
    contributionRequestReminders,
    runSurgeryUploadEvidenceReviewReport,
    runFiImageIntelligenceWorker,
    longitudinalEngagementDailyScan,
  ],
});
