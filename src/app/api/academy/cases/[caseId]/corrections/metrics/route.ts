import { NextResponse } from "next/server";
import { requireTrainingCaseCorrectionAccess } from "@/lib/academy/trainingCaseCorrections/permissions";
import { revalidateTrainingCasePaths } from "@/lib/academy/trainingCaseCorrections/revalidate";
import { updateTrainingCaseMetrics } from "@/lib/academy/trainingCaseCorrections/service";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { access, supabase } = await requireTrainingCaseCorrectionAccess(caseId);
    const body = await req.json();
    const acknowledgeHairWarning = Boolean((body as { acknowledgeHairWarning?: boolean })?.acknowledgeHairWarning);
    const result = await updateTrainingCaseMetrics(supabase, caseId, access.userId, body, { acknowledgeHairWarning });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: "code" in result ? result.code : undefined },
        { status: result.status }
      );
    }
    revalidateTrainingCasePaths(caseId);
    return NextResponse.json({ ok: true, metrics: result.metrics });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 403;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}
