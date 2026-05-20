import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";
import { readMetricsPatch, upsertTrainingCaseMetrics } from "@/lib/academy/trainingCaseMetrics";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { caseId } = await ctx.params;
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const patch = readMetricsPatch(raw);
  const { data, error } = await upsertTrainingCaseMetrics(supabase, caseId, patch);

  if (error) {
    console.error("[training_case_metrics] upsert failed", { caseId, message: error.message, code: error.code });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, metrics: data });
}
