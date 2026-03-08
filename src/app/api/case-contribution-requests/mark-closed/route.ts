import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getUserRole } from "@/lib/case-access";
import { markRequestClosed } from "@/lib/transparency/requestLifecycle";

export async function POST(req: Request) {
  try {
    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = await getUserRole(user.id);
    if (role !== "auditor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId ?? "").trim();
    if (!requestId) return NextResponse.json({ error: "Missing requestId." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: requestRow } = await admin
      .from("case_contribution_requests")
      .select("id, case_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!requestRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    await markRequestClosed(admin, requestId);
    await admin.from("cases").update({ status: "request_closed" }).eq("id", requestRow.case_id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    console.error("case-contribution-requests/mark-closed POST:", errMsg, e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
