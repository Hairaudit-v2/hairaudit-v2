import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireDevRouteAccess } from "@/lib/security/routeGuards";

export async function GET() {
  const gate = await requireDevRouteAccess();
  if (!gate.ok) return gate.response;

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("cases")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cases: data ?? [] });
}
