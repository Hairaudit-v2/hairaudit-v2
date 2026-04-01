import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

type MetricsBody = Partial<{
  grafts_attempted: number | null;
  grafts_extracted: number | null;
  grafts_implanted: number | null;
  extraction_minutes: number | null;
  implantation_minutes: number | null;
  total_minutes: number | null;
  extraction_grafts_per_hour: number | null;
  implantation_grafts_per_hour: number | null;
  transection_rate: number | null;
  buried_graft_rate: number | null;
  popping_rate: number | null;
  out_of_body_time_estimate: number | null;
  punch_size: string | null;
  punch_type: string | null;
  implantation_method: string | null;
  total_hairs: number | null;
  hair_to_graft_ratio: number | null;
  observed_by_trainer: boolean | null;
}>;

export async function PUT(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { caseId } = await ctx.params;
  let body: MetricsBody;
  try {
    body = (await req.json()) as MetricsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const row: Record<string, unknown> = { training_case_id: caseId };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) row[k] = v;
  }

  const th = row.total_hairs != null ? Number(row.total_hairs) : null;
  const graftsForRatio =
    row.grafts_extracted != null
      ? Number(row.grafts_extracted)
      : row.grafts_implanted != null
        ? Number(row.grafts_implanted)
        : null;
  if (th != null && graftsForRatio != null && graftsForRatio > 0 && Number.isFinite(th) && Number.isFinite(graftsForRatio)) {
    row.hair_to_graft_ratio = Math.round((th / graftsForRatio) * 1000) / 1000;
  }

  const { data, error } = await supabase
    .from("training_case_metrics")
    .upsert(row, { onConflict: "training_case_id" })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, metrics: data });
}
