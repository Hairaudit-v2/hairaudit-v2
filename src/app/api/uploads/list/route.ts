import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCaseAccess, requireUser } from "@/lib/auth/permissions";
import { resolveUploadTypePrefixForList } from "@/lib/uploads/listTypePrefix";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId") ?? "";
    const typePrefix = resolveUploadTypePrefixForList(url.searchParams.get("prefix"));

    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const userGate = await requireUser(supabaseAuth);
    if (!userGate.ok) return userGate.response;

    const caseGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId,
      supabaseAuth,
    });
    if (!caseGate.ok) return caseGate.response;

    const supabase = createSupabaseAdminClient();
    const bucket = process.env.CASE_FILES_BUCKET || "case-files";

    const { data: uploads, error } = await supabase
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = uploads ?? [];
    const patient = rows.filter((u) => String(u.type ?? "").startsWith(typePrefix));

    const signed = await Promise.all(
      patient.map(async (u) => {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(String(u.storage_path), 60 * 10);
        return { ...u, signedUrl: data?.signedUrl ?? null };
      })
    );

    const byCategory: Record<string, unknown[]> = {};
    for (const u of signed) {
      const cat = (u as { metadata?: { category?: string }; type?: string }).metadata?.category ?? String(u.type).split(":")[1] ?? "uncategorized";
      byCategory[cat] = byCategory[cat] || [];
      byCategory[cat].push(u);
    }

    return NextResponse.json({ ok: true, byCategory, uploads: signed });
  } catch (e) {
    console.error("[uploads/list] Error:", e);
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? "Internal server error" }, { status: 500 });
  }
}
