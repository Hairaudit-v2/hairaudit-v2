import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser, requireCaseAccess } from "@/lib/security/caseAccess.server";
import { filterUploadRowsToCaseStorageNamespace, isWellFormedCaseId } from "@/lib/uploads/caseFilesPath";
import { resolveUploadTypePrefixForList } from "@/lib/uploads/listTypePrefix";
import {
  gateUploadCaseStoragePath,
  resolveCaseFilesBucketForRoute,
} from "@/lib/hairaudit/uploadStorage";
import { getErrorMessage } from "@/lib/security/errorLogging";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId") ?? "";
    const typePrefix = resolveUploadTypePrefixForList(url.searchParams.get("prefix"));

    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    }
    if (!isWellFormedCaseId(caseId)) {
      return NextResponse.json({ ok: false, error: "Invalid caseId" }, { status: 400 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const userGate = await requireAuthenticatedUser(supabaseAuth);
    if (!userGate.ok) return userGate.response;

    const caseGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId,
      supabaseAuth,
    });
    if (!caseGate.ok) return caseGate.response;

    const bucketGate = resolveCaseFilesBucketForRoute();
    if (!bucketGate.ok) {
      console.error("[uploads/list] Bucket resolution failed");
      return NextResponse.json({ ok: false, error: bucketGate.error }, { status: bucketGate.status });
    }

    const supabase = createSupabaseAdminClient();
    const bucket = bucketGate.bucket;

    const { data: uploads, error } = await supabase
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[uploads/list] Upload query failed:", getErrorMessage(error));
      return NextResponse.json({ ok: false, error: "Could not list uploads" }, { status: 500 });
    }

    const rows = filterUploadRowsToCaseStorageNamespace(caseId, uploads ?? []);
    const patient = rows.filter((u) => String(u.type ?? "").startsWith(typePrefix));

    const signed = await Promise.all(
      patient.map(async (u) => {
        const rawPath = String(u.storage_path ?? "");
        const pathGate = gateUploadCaseStoragePath(caseId, rawPath);
        if (!pathGate.ok) {
          return { ...u, signedUrl: null };
        }

        const { data, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(pathGate.normalizedPath, 60 * 10);

        if (signErr) {
          console.error("[uploads/list] Signed URL failed:", getErrorMessage(signErr));
          return { ...u, signedUrl: null };
        }

        return { ...u, signedUrl: data?.signedUrl ?? null };
      })
    );

    const byCategory: Record<string, unknown[]> = {};
    for (const u of signed) {
      const cat =
        (u as { metadata?: { category?: string }; type?: string }).metadata?.category ??
        String(u.type).split(":")[1] ??
        "uncategorized";
      byCategory[cat] = byCategory[cat] || [];
      byCategory[cat].push(u);
    }

    return NextResponse.json({ ok: true, byCategory, uploads: signed });
  } catch (e) {
    console.error("[uploads/list] Error:", getErrorMessage(e));
    return NextResponse.json({ ok: false, error: "Could not list uploads" }, { status: 500 });
  }
}
