import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Action = "approve" | "needs_more_evidence" | "reject" | "approve_with_overrides";

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function toTextOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function computeVariancePct(claimed: number | null, est: number | null): number | null {
  if (!claimed || claimed <= 0 || est === null) return null;
  return ((est - claimed) / claimed) * 100;
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profErr } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    const isAuditor = profile?.role === "auditor" || user.email === "auditor@hairaudit.com";
    if (!isAuditor) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as any;
    const estimateId = String(body?.estimateId ?? "").trim();
    const action = String(body?.action ?? "").trim() as Action;
    const internalNotes = toTextOrNull(body?.internalNotes);
    const publicNote = toTextOrNull(body?.publicNote);

    if (!estimateId) return NextResponse.json({ ok: false, error: "Missing estimateId" }, { status: 400 });
    if (!["approve", "needs_more_evidence", "reject", "approve_with_overrides"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const { data: existing, error: selErr } = await admin
      .from("graft_integrity_estimates")
      .select(
        "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, auditor_adjustments"
      )
      .eq("id", estimateId)
      .maybeSingle();
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ ok: false, error: "Estimate not found" }, { status: 404 });

    const now = new Date().toISOString();
    const claimed = (existing as any).claimed_grafts as number | null;
    const prevAdjustments = ((existing as any).auditor_adjustments ?? {}) as Record<string, unknown>;

    const baseAdjustments: Record<string, unknown> = {
      ...prevAdjustments,
      ...(publicNote ? { public_note: publicNote } : {}),
      updated_at: now,
    };

    const update: Record<string, unknown> = {
      auditor_notes: internalNotes,
      audited_by: user.id,
      audited_at: now,
      updated_at: now,
    };

    if (action === "approve") {
      update.auditor_status = "approved";
      update.auditor_adjustments = baseAdjustments;
    }

    if (action === "needs_more_evidence") {
      update.auditor_status = "needs_more_evidence";
      update.auditor_adjustments = baseAdjustments;
    }

    if (action === "reject") {
      update.auditor_status = "rejected";
      update.auditor_adjustments = baseAdjustments;
    }

    if (action === "approve_with_overrides") {
      const extractedMin = toIntOrNull(body?.overrides?.extracted_min);
      const extractedMax = toIntOrNull(body?.overrides?.extracted_max);
      const implantedMin = toIntOrNull(body?.overrides?.implanted_min);
      const implantedMax = toIntOrNull(body?.overrides?.implanted_max);

      const overrideRanges = {
        extracted: { min: extractedMin, max: extractedMax },
        implanted: { min: implantedMin, max: implantedMax },
      };

      update.auditor_status = "approved";
      update.auditor_adjustments = { ...baseAdjustments, overrides: overrideRanges };

      // Override the stored estimate ranges so patient-facing reads are consistent.
      update.estimated_extracted_min = extractedMin;
      update.estimated_extracted_max = extractedMax;
      update.estimated_implanted_min = implantedMin;
      update.estimated_implanted_max = implantedMax;

      // Recalculate variance vs claimed using overrides (if claimed available).
      update.variance_claimed_vs_extracted_min_pct = computeVariancePct(claimed, extractedMin);
      update.variance_claimed_vs_extracted_max_pct = computeVariancePct(claimed, extractedMax);
      update.variance_claimed_vs_implanted_min_pct = computeVariancePct(claimed, implantedMin);
      update.variance_claimed_vs_implanted_max_pct = computeVariancePct(claimed, implantedMax);
    }

    const { error: upErr } = await admin.from("graft_integrity_estimates").update(update).eq("id", estimateId);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "Server error") }, { status: 500 });
  }
}

