import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export type BulkUploadAdminContext =
  | { ok: true; userId: string; email: string | undefined }
  | { ok: false; status: number; error: string };

export async function requireHairAuditBulkAdmin(): Promise<BulkUploadAdminContext> {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, userId: user.id, email: user.email ?? undefined };
}
