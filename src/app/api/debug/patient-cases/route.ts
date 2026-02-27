import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "@/lib/roles";

/**
 * GET /api/debug/patient-cases
 * Auth-protected debug endpoint to compare patient dashboard case matching.
 */
export async function GET() {
  try {
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const [{ data: profile }, { data: byPatientId, error: byPatientErr }, { data: byUserId, error: byUserErr }, { data: finalDashboardList, error: finalErr }] =
      await Promise.all([
        admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        admin
          .from("cases")
          .select("id, title, status, created_at, submitted_at, user_id, patient_id, doctor_id, clinic_id")
          .eq("patient_id", user.id)
          .order("created_at", { ascending: false }),
        admin
          .from("cases")
          .select("id, title, status, created_at, submitted_at, user_id, patient_id, doctor_id, clinic_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        admin
          .from("cases")
          .select("id, title, status, created_at, submitted_at, user_id, patient_id, doctor_id, clinic_id")
          .or(`patient_id.eq.${user.id},and(user_id.eq.${user.id},patient_id.is.null)`)
          .order("created_at", { ascending: false }),
      ]);

    const roleFromUserMetadata = parseRole((user.user_metadata as Record<string, unknown>)?.role) ?? null;
    const roleFromProfile = parseRole(profile?.role) ?? null;

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      roles: {
        from_user_metadata: roleFromUserMetadata,
        from_profiles_table: roleFromProfile,
        effective_like_dashboard_redirect: roleFromProfile ?? roleFromUserMetadata ?? "patient",
      },
      counts: {
        by_patient_id: byPatientId?.length ?? 0,
        by_user_id: byUserId?.length ?? 0,
        final_dashboard_list: finalDashboardList?.length ?? 0,
      },
      query_errors: {
        by_patient_id: byPatientErr?.message ?? null,
        by_user_id: byUserErr?.message ?? null,
        final_dashboard_list: finalErr?.message ?? null,
      },
      cases: {
        by_patient_id: byPatientId ?? [],
        by_user_id: byUserId ?? [],
        final_dashboard_list: finalDashboardList ?? [],
      },
    });
  } catch (error) {
    const message = (error as Error)?.message ?? "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
