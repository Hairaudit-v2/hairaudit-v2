import { NextResponse } from "next/server";
import { requireAcademyStaff } from "@/lib/academy/auth";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { revalidateTrainingCasePaths } from "@/lib/academy/trainingCaseCorrections/revalidate";
import {
  deleteTrainingCaseUpload,
  updateTrainingCaseUploadCategory,
} from "@/lib/academy/trainingCaseCorrections/service";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ uploadId: string }> }) {
  try {
    const access = await requireAcademyStaff();
    const { uploadId } = await ctx.params;
    const supabase = await createSupabaseAuthServerClient();
    const body = await req.json();
    const result = await updateTrainingCaseUploadCategory(supabase, uploadId, access.userId, body);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    if (result.upload?.training_case_id) revalidateTrainingCasePaths(String(result.upload.training_case_id));
    return NextResponse.json({ ok: true, upload: result.upload });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 403 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ uploadId: string }> }) {
  try {
    const access = await requireAcademyStaff();
    const { uploadId } = await ctx.params;
    const supabase = await createSupabaseAuthServerClient();
    const body = await req.json();
    const result = await deleteTrainingCaseUpload(supabase, uploadId, access.userId, body);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    revalidateTrainingCasePaths(result.caseId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 403 });
  }
}
