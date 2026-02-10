import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  // 1) Read logged in user from cookies
  const supabaseAuth = await createSupabaseAuthServerClient();
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2) Insert using admin client (no RLS problems), but set user_id explicitly
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("cases")
    .insert({
      user_id: user.id,
      status: "draft",
      title: "Patient Audit",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, caseId: data.id });
}