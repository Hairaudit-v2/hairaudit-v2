import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { caseId } = await req.json();

    if (!caseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id,user_id,status,submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr) {
      return NextResponse.json({ error: caseErr.message }, { status: 500 });
    }
    if (!c) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    if (c.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (c.submitted_at || c.status === "submitted") {
      return NextResponse.json({ error: "Case already submitted" }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { error: updErr } = await admin
      .from("cases")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .eq("user_id", user.id)
      .eq("status", "draft");

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    await inngest.send({
      name: "case/submitted",
      data: { caseId, userId: user.id },
    });

    return NextResponse.json({ ok: true, submitted_at: now });
  } catch (e: any) {
    console.error("submit-case error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}