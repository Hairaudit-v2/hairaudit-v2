import { NextResponse } from "next/server";
import { fetchTrainingCaseCorrections } from "@/lib/academy/trainingCaseCorrections/audit";
import { requireTrainingCaseCorrectionAccess } from "@/lib/academy/trainingCaseCorrections/permissions";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { supabase } = await requireTrainingCaseCorrectionAccess(caseId);
    const rows = await fetchTrainingCaseCorrections(supabase, caseId);
    return NextResponse.json({ ok: true, corrections: rows });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 403;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}
