import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { DEFAULT_TRAINING_PROGRAM_ID } from "@/lib/academy/constants";
import type { TrainingDoctorRow } from "@/lib/academy/types";
import TraineeEditClient from "@/components/academy/TraineeEditClient";

export const dynamic = "force-dynamic";

export default async function TraineeEditPage({ params }: { params: Promise<{ doctorId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect("/academy/dashboard");

  const { doctorId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: doctor, error } = await supabase.from("training_doctors").select("*").eq("id", doctorId).maybeSingle();
  if (error || !doctor) notFound();

  const [{ data: programs }, { data: sites }, { data: trainerRows }] = await Promise.all([
    supabase.from("training_programs").select("id, name, is_active").order("name"),
    supabase.from("academy_sites").select("id, name, display_name").order("name"),
    supabase.from("academy_users").select("user_id, display_name, email").eq("role", "trainer").order("display_name"),
  ]);

  const programOptions = (programs ?? []).filter((p: { is_active?: boolean }) => p.is_active !== false);
  const siteOptions = ((sites ?? []) as { id: string; name: string; display_name: string | null }[]).map((s) => ({
    id: s.id,
    label: s.display_name?.trim() || s.name,
  }));
  const trainerOptions = ((trainerRows ?? []) as { user_id: string; display_name: string | null; email: string | null }[]).map(
    (t) => ({
      user_id: t.user_id,
      label: t.display_name?.trim() || t.email || t.user_id.slice(0, 8),
    })
  );

  return (
    <TraineeEditClient
      doctorId={doctorId}
      doctor={doctor as TrainingDoctorRow}
      programOptions={
        programOptions.length
          ? programOptions.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
          : [{ id: DEFAULT_TRAINING_PROGRAM_ID, name: "Standard FUE Academy" }]
      }
      siteOptions={siteOptions}
      trainerOptions={trainerOptions}
    />
  );
}
