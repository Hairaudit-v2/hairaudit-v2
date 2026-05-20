import { NextResponse } from "next/server";
import { requireTrainingCaseCorrectionAccess } from "@/lib/academy/trainingCaseCorrections/permissions";
import { revalidateTrainingCasePaths } from "@/lib/academy/trainingCaseCorrections/revalidate";
import { archiveTrainingCase } from "@/lib/academy/trainingCaseCorrections/service";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { access, supabase } = await requireTrainingCaseCorrectionAccess(caseId);
    const body = await req.json();
    const result = await archiveTrainingCase(supabase, caseId, access.userId, body);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    revalidateTrainingCasePaths(caseId);
    return NextResponse.json({ ok: true, case: result.case });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 403;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}
