import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LOG_PREFIX = "[api/cases/create]";

export async function POST() {
  // 1) Auth: use same server cookie session as case page (avoids "case not found" right after login)
  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAuthServerClient failed", { error: e });
    return NextResponse.json(
      { ok: false, error: "Auth unavailable" },
      { status: 500 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError) {
    console.error(LOG_PREFIX, "getUser error", { error: userError.message, code: userError.code });
    return NextResponse.json(
      { ok: false, error: "Invalid session" },
      { status: 401 }
    );
  }

  if (!user) {
    console.error(LOG_PREFIX, "no user in session");
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const userId = user.id;
  console.info(LOG_PREFIX, "authenticated user", { userId });

  // 2) Role for case linking
  let role = (user.user_metadata as Record<string, unknown>)?.role as string | undefined;
  try {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role) role = profile.role as string;
  } catch {
    /* profiles may not exist */
  }
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const devRole = cookieStore.get("dev_role")?.value;
    if (devRole && ["patient", "doctor", "clinic", "auditor"].includes(devRole)) role = devRole;
  }

  const insertData: Record<string, unknown> = {
    user_id: userId,
    title: role === "doctor" ? "Doctor audit" : role === "clinic" ? "Clinic audit" : "Patient Audit",
    status: "draft",
    audit_type: role === "doctor" ? "doctor" : role === "clinic" ? "clinic" : "patient",
    submission_channel:
      role === "doctor" ? "doctor_submitted" : role === "clinic" ? "clinic_submitted" : "patient_submitted",
    visibility_scope: role === "patient" ? "public" : "internal",
  };
  if (role === "patient") insertData.patient_id = userId;
  if (role === "doctor") insertData.doctor_id = userId;
  if (role === "clinic") insertData.clinic_id = userId;

  // 3) Insert and get inserted row id explicitly
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (e) {
    console.error(LOG_PREFIX, "createSupabaseAdminClient failed", { userId, error: e });
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  const { data: insertResult, error: insertError } = await supabaseAdmin
    .from("cases")
    .insert(insertData)
    .select("id")
    .single();

  if (insertError) {
    console.error(LOG_PREFIX, "insert failed", { userId, error: insertError.message, code: insertError.code });
    return NextResponse.json(
      { ok: false, error: insertError.message },
      { status: 500 }
    );
  }

  const insertedId = insertResult?.id;
  if (insertedId == null || String(insertedId).trim() === "") {
    console.error(LOG_PREFIX, "insert returned no id", { userId, insertResult });
    return NextResponse.json(
      { ok: false, error: "Case was not created; please try again." },
      { status: 500 }
    );
  }

  const caseId = String(insertedId);

  // 4) Post-insert verification: ensure row exists and user_id matches
  const { data: verifyRow, error: verifyError } = await supabaseAdmin
    .from("cases")
    .select("id, user_id")
    .eq("id", caseId)
    .maybeSingle();

  if (verifyError) {
    console.error(LOG_PREFIX, "post-insert verify query failed", { caseId, userId, error: verifyError.message });
    return NextResponse.json(
      { ok: false, error: "Case creation could not be verified; please try again." },
      { status: 500 }
    );
  }

  if (!verifyRow || verifyRow.user_id !== userId) {
    console.error(LOG_PREFIX, "post-insert verify mismatch or missing row", { caseId, userId, verifyRow });
    return NextResponse.json(
      { ok: false, error: "Case creation could not be verified; please try again." },
      { status: 500 }
    );
  }

  console.info(LOG_PREFIX, "success", { caseId, userId });
  return NextResponse.json({ ok: true, caseId });
}
