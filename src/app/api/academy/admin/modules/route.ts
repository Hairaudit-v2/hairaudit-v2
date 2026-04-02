import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAllowedTrainingDoctorsPublicUrl } from "@/lib/academy/trainingModulesCatalog";

export const runtime = "nodejs";

function normalizeModuleId(raw: string): string {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: modules, error } = await admin.from("training_modules").select("*").order("title", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (modules ?? []).map((m: { id: string }) => m.id);
  if (!ids.length) return NextResponse.json({ ok: true, modules: [], userAssignments: [], cohortAssignments: [] });

  const [{ data: userAssigns }, { data: cohortAssigns }] = await Promise.all([
    admin.from("training_module_user_assignments").select("module_id, user_id").in("module_id", ids),
    admin.from("training_module_cohort_assignments").select("module_id, cohort_id").in("module_id", ids),
  ]);

  return NextResponse.json({
    ok: true,
    modules: modules ?? [],
    userAssignments: userAssigns ?? [],
    cohortAssignments: cohortAssigns ?? [],
  });
}

type ModuleBody = {
  id?: string;
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

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  let body: ModuleBody;
  try {
    body = (await req.json()) as ModuleBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = normalizeModuleId(String(body.id ?? ""));
  const title = String(body.title ?? "").trim();
  const short_description = String(body.short_description ?? "").trim();
  if (!id || !title || !short_description) {
    return NextResponse.json({ ok: false, error: "id, title, and short_description are required" }, { status: 400 });
  }

  const read_online_url = body.read_online_url?.trim() || null;
  const download_url = body.download_url?.trim() || null;
  const cover_image_url = body.cover_image_url?.trim() || null;
  if (read_online_url && !isAllowedTrainingDoctorsPublicUrl(read_online_url)) {
    return NextResponse.json({ ok: false, error: "read_online_url must be under /training/doctors/" }, { status: 400 });
  }
  if (download_url && !isAllowedTrainingDoctorsPublicUrl(download_url)) {
    return NextResponse.json({ ok: false, error: "download_url must be under /training/doctors/" }, { status: 400 });
  }
  if (cover_image_url && !isAllowedTrainingDoctorsPublicUrl(cover_image_url)) {
    return NextResponse.json({ ok: false, error: "cover_image_url must be under /training/doctors/" }, { status: 400 });
  }

  const last_updated = String(body.last_updated ?? "").trim().slice(0, 10) || new Date().toISOString().slice(0, 10);
  const weeks = Array.isArray(body.recommended_weeks)
    ? body.recommended_weeks.map((n) => Number(n)).filter((n) => n >= 1 && n <= 12)
    : [];
  const ladderKeys = Array.isArray(body.related_competency_ladder_keys)
    ? body.related_competency_ladder_keys.map((k) => String(k).trim()).filter(Boolean)
    : [];

  const admin = createSupabaseAdminClient();
  const { data: mod, error } = await admin
    .from("training_modules")
    .insert({
      id,
      title,
      short_description,
      category: String(body.category ?? "General").trim() || "General",
      last_updated,
      read_online_url,
      download_url,
      cover_image_url,
      status: body.status === "draft" ? "draft" : "approved",
      mandatory: Boolean(body.mandatory),
      recommended: Boolean(body.recommended),
      recommended_weeks: weeks,
      related_competency_ladder_keys: ladderKeys,
      requires_assignment: Boolean(body.requires_assignment),
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const uids = Array.isArray(body.assigned_user_ids) ? body.assigned_user_ids.map((x) => String(x).trim()).filter(Boolean) : [];
  const cids = Array.isArray(body.assigned_cohort_ids) ? body.assigned_cohort_ids.map((x) => String(x).trim()).filter(Boolean) : [];
  if (uids.length) {
    await admin.from("training_module_user_assignments").insert(uids.map((user_id) => ({ module_id: id, user_id })));
  }
  if (cids.length) {
    await admin.from("training_module_cohort_assignments").insert(cids.map((cohort_id) => ({ module_id: id, cohort_id })));
  }

  return NextResponse.json({ ok: true, module: mod });
}
