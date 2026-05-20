import { requireAcademyStaff, requireAcademyAdmin } from "@/lib/academy/auth";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export async function requireTrainingCaseCorrectionAccess(caseId: string) {
  const access = await requireAcademyStaff();
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error } = await supabase.from("training_cases").select("id, deleted_at").eq("id", caseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) {
    const err = new Error("not_found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  return { access, supabase, caseRow: c };
}

export async function requireTrainingCaseHardDeleteAccess(caseId: string) {
  const access = await requireAcademyAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const { data: c, error } = await supabase.from("training_cases").select("id").eq("id", caseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) {
    const err = new Error("not_found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  return { access, supabase, caseRow: c };
}
