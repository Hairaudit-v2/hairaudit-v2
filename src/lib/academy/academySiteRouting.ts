import type { SupabaseClient } from "@supabase/supabase-js";
import { academyOpsInboxAddress } from "@/lib/academy/onboardingTemplate";
import type { AcademySiteRow } from "@/lib/academy/academySites";
import { getAcademySiteById } from "@/lib/academy/academySites";

export type AcademyOpsEmailSource = "site_ops" | "env_fallback" | "none";

export function resolveAcademyOpsEmailWithSource(
  site: Pick<AcademySiteRow, "ops_notification_email"> | null
): { email: string | null; source: AcademyOpsEmailSource } {
  const fromSite = site?.ops_notification_email?.trim();
  if (fromSite) return { email: fromSite, source: "site_ops" };
  const env = academyOpsInboxAddress();
  if (env) return { email: env, source: "env_fallback" };
  return { email: null, source: "none" };
}

/** Final inbox address: site ops_notification_email, else ACADEMY_OPS_NOTIFICATION_EMAIL env. */
export function resolveAcademyOpsEmail(
  site: Pick<AcademySiteRow, "ops_notification_email"> | null
): string | null {
  return resolveAcademyOpsEmailWithSource(site).email;
}

export async function getOpsEmailForProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<{
  email: string | null;
  source: AcademyOpsEmailSource;
  site: AcademySiteRow | null;
}> {
  const { data: prog } = await supabase
    .from("training_programs")
    .select("academy_site_id")
    .eq("id", programId)
    .maybeSingle();

  if (!prog?.academy_site_id) {
    const { email, source } = resolveAcademyOpsEmailWithSource(null);
    return { email, source, site: null };
  }

  const site = await getAcademySiteById(supabase, prog.academy_site_id);
  const { email, source } = resolveAcademyOpsEmailWithSource(site);
  return { email, source, site };
}

export async function getOpsEmailForTrainingDoctor(
  supabase: SupabaseClient,
  doctorId: string
): Promise<{
  email: string | null;
  source: AcademyOpsEmailSource;
  site: AcademySiteRow | null;
}> {
  const { data: doc } = await supabase
    .from("training_doctors")
    .select("academy_site_id, program_id")
    .eq("id", doctorId)
    .maybeSingle();

  if (!doc) {
    return { email: null, source: "none", site: null };
  }

  if (doc.academy_site_id) {
    const site = await getAcademySiteById(supabase, doc.academy_site_id);
    const { email, source } = resolveAcademyOpsEmailWithSource(site);
    return { email, source, site };
  }

  if (doc.program_id) {
    return getOpsEmailForProgram(supabase, doc.program_id);
  }

  const { email, source } = resolveAcademyOpsEmailWithSource(null);
  return { email, source, site: null };
}

export type OnboardingRoute =
  | "training_doctor"
  | "training_program"
  | "academy_site"
  | "env_only"
  | null;

export type ResolvedOnboardingRecipient = {
  email: string | null;
  source: AcademyOpsEmailSource;
  site: AcademySiteRow | null;
  route: OnboardingRoute;
};

/**
 * Priority: trainee (doctor) → program → explicit site → env fallback only.
 */
export async function resolveOnboardingOpsRecipient(
  supabase: SupabaseClient,
  input: {
    trainingDoctorId?: string | null;
    trainingProgramId?: string | null;
    academySiteId?: string | null;
  }
): Promise<ResolvedOnboardingRecipient> {
  const doctorId = input.trainingDoctorId?.trim();
  const programId = input.trainingProgramId?.trim();
  const siteId = input.academySiteId?.trim();

  if (doctorId) {
    const r = await getOpsEmailForTrainingDoctor(supabase, doctorId);
    return { ...r, route: "training_doctor" };
  }
  if (programId) {
    const r = await getOpsEmailForProgram(supabase, programId);
    return { ...r, route: "training_program" };
  }
  if (siteId) {
    const site = await getAcademySiteById(supabase, siteId);
    const { email, source } = resolveAcademyOpsEmailWithSource(site);
    return { email, source, site, route: "academy_site" };
  }

  const env = academyOpsInboxAddress();
  if (env) {
    return { email: env, source: "env_fallback", site: null, route: "env_only" };
  }
  return { email: null, source: "none", site: null, route: null };
}
