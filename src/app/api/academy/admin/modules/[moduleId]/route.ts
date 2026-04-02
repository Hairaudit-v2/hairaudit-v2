import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAllowedTrainingDoctorsPublicUrl } from "@/lib/academy/trainingModulesCatalog";

export const runtime = "nodejs";

type PatchBody = {
  title?: string;
  short_description?: string;
  category?: string;
  last_updated?: string;
  read_online_url?: string | null;
  download_url?: string | null;
  cover_image_url?: string | null;
  status?: "approved" | "draft";
  mandatory?: boolean;
  recommended?: boolean;
  recommended_weeks?: number[];
  related_competency_ladder_keys?: string[];
  requires_assignment?: boolean;
  assigned_user_ids?: string[];
  assigned_cohort_ids?: string[];
};

export async function PATCH(req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { moduleId } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.short_description !== undefined) patch.short_description = String(body.short_description).trim();
  if (body.category !== undefined) patch.category = String(body.category).trim() || "General";
  if (body.last_updated !== undefined) {
    patch.last_updated = String(body.last_updated).trim().slice(0, 10) || new Date().toISOString().slice(0, 10);
  }
  if (body.read_online_url !== undefined) {
    const u = body.read_online_url?.trim() || null;
    if (u && !isAllowedTrainingDoctorsPublicUrl(u)) {
      return NextResponse.json({ ok: false, error: "read_online_url must be under /training/doctors/" }, { status: 400 });
    }
    patch.read_online_url = u;
  }
  if (body.download_url !== undefined) {
    const u = body.download_url?.trim() || null;
    if (u && !isAllowedTrainingDoctorsPublicUrl(u)) {
      return NextResponse.json({ ok: false, error: "download_url must be under /training/doctors/" }, { status: 400 });
    }
    patch.download_url = u;
  }
  if (body.cover_image_url !== undefined) {
    const u = body.cover_image_url?.trim() || null;
    if (u && !isAllowedTrainingDoctorsPublicUrl(u)) {
      return NextResponse.json({ ok: false, error: "cover_image_url must be under /training/doctors/" }, { status: 400 });
    }
    patch.cover_image_url = u;
  }
  if (body.status !== undefined) patch.status = body.status === "draft" ? "draft" : "approved";
  if (body.mandatory !== undefined) patch.mandatory = Boolean(body.mandatory);
  if (body.recommended !== undefined) patch.recommended = Boolean(body.recommended);
  if (body.recommended_weeks !== undefined) {
    patch.recommended_weeks = body.recommended_weeks.map((n) => Number(n)).filter((n) => n >= 1 && n <= 12);
  }
  if (body.related_competency_ladder_keys !== undefined) {
    patch.related_competency_ladder_keys = body.related_competency_ladder_keys.map((k) => String(k).trim()).filter(Boolean);
  }
  if (body.requires_assignment !== undefined) patch.requires_assignment = Boolean(body.requires_assignment);

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("training_modules").update(patch).eq("id", moduleId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (body.assigned_user_ids !== undefined) {
    await admin.from("training_module_user_assignments").delete().eq("module_id", moduleId);
    const uids = body.assigned_user_ids.map((x) => String(x).trim()).filter(Boolean);
    if (uids.length) {
      await admin.from("training_module_user_assignments").insert(uids.map((user_id) => ({ module_id: moduleId, user_id })));
    }
  }

  if (body.assigned_cohort_ids !== undefined) {
    await admin.from("training_module_cohort_assignments").delete().eq("module_id", moduleId);
    const cids = body.assigned_cohort_ids.map((x) => String(x).trim()).filter(Boolean);
    if (cids.length) {
      await admin
        .from("training_module_cohort_assignments")
        .insert(cids.map((cohort_id) => ({ module_id: moduleId, cohort_id })));
    }
  }

  const { data: module } = await admin.from("training_modules").select("*").eq("id", moduleId).maybeSingle();
  return NextResponse.json({ ok: true, module });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { moduleId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("training_modules").delete().eq("id", moduleId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
