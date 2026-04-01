import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveOnboardingOpsRecipient } from "@/lib/academy/academySiteRouting";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const trainingDoctorId = url.searchParams.get("trainingDoctorId")?.trim() || undefined;
  const trainingProgramId = url.searchParams.get("trainingProgramId")?.trim() || undefined;
  const academySiteId = url.searchParams.get("academySiteId")?.trim() || undefined;

  const admin = createSupabaseAdminClient();
  const resolved = await resolveOnboardingOpsRecipient(admin, {
    trainingDoctorId: trainingDoctorId || null,
    trainingProgramId: trainingProgramId || null,
    academySiteId: academySiteId || null,
  });

  const siteLabel = resolved.site
    ? resolved.site.display_name?.trim() || resolved.site.name
    : null;

  return NextResponse.json({
    ok: true,
    email: resolved.email,
    source: resolved.source,
    route: resolved.route,
    siteId: resolved.site?.id ?? null,
    siteName: resolved.site?.name ?? null,
    siteLabel,
    siteSlug: resolved.site?.slug ?? null,
  });
}
