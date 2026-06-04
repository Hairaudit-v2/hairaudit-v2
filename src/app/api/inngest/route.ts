// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { runAudit, runGraftIntegrityEstimate, runPdfRebuild, auditorRerun } from "@/lib/inngest/functions";
import { runSurgeryUploadEvidenceReviewReport } from "@/lib/inngest/functions/surgeryUploadEvidenceReviewReport";
import { contributionRequestReminders } from "@/lib/inngest/functions/contributionRequestReminders";
import { historicalGiiBackfillWorkflow } from "@/lib/inngest/functions/historicalGiiBackfill";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runAudit,
    runGraftIntegrityEstimate,
    runPdfRebuild,
    auditorRerun,
    historicalGiiBackfillWorkflow,
    contributionRequestReminders,
    runSurgeryUploadEvidenceReviewReport,
  ],
});
