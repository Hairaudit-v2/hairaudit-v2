import { NextResponse } from "next/server";
import { correctionReasonSchema } from "@/lib/academy/trainingCaseCorrections/validation";
import { requireTrainingCaseCorrectionAccess, requireTrainingCaseHardDeleteAccess } from "@/lib/academy/trainingCaseCorrections/permissions";
import { revalidateTrainingCasePaths } from "@/lib/academy/trainingCaseCorrections/revalidate";
import { hardDeleteTrainingCase, softDeleteTrainingCase } from "@/lib/academy/trainingCaseCorrections/service";

export const runtime = "nodejs";

/** Soft delete (staff) */
export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { access, supabase } = await requireTrainingCaseCorrectionAccess(caseId);
    const body = await req.json();
    const result = await softDeleteTrainingCase(supabase, caseId, access.userId, body);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    revalidateTrainingCasePaths(caseId);
    return NextResponse.json({ ok: true, case: result.case });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 403;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}

/** Hard delete (academy_admin only) */
export async function DELETE(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { access, supabase } = await requireTrainingCaseHardDeleteAccess(caseId);
    const body = await req.json().catch(() => ({}));
    const reasonParsed = correctionReasonSchema.safeParse((body as { reason?: string }).reason ?? "");
    if (!reasonParsed.success) {
      return NextResponse.json({ ok: false, error: reasonParsed.error.message }, { status: 400 });
    }
    const result = await hardDeleteTrainingCase(supabase, caseId, access.userId, reasonParsed.data);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    revalidateTrainingCasePaths(caseId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 403;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}
