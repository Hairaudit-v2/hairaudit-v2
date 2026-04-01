import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";

export const dynamic = "force-dynamic";

export default async function NewTrainingCasePage({ params }: { params: Promise<{ doctorId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect("/academy/dashboard");

  const { doctorId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: doctor, error } = await supabase.from("training_doctors").select("id, full_name").eq("id", doctorId).maybeSingle();
  if (error || !doctor) notFound();

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href={`/academy/trainees/${doctorId}`} className="text-sm font-medium text-amber-700 hover:underline">
          ← {doctor.full_name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">New training case</h1>
      </div>

      <form
        action={async (formData) => {
          "use server";
          const a = await getAcademyAccess();
          if (!a.ok || !a.isStaff) redirect("/academy/dashboard");

          const surgery_date = String(formData.get("surgery_date") || "").trim();
          if (!surgery_date) redirect(`/academy/trainees/${doctorId}/new-case`);

          const supabase = await createSupabaseAuthServerClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) redirect("/academy/login");

          const { data, error: insErr } = await supabase
            .from("training_cases")
            .insert({
              training_doctor_id: doctorId,
              trainer_id: user.id,
              surgery_date,
              procedure_type: String(formData.get("procedure_type") || "").trim() || null,
              complexity_level: String(formData.get("complexity_level") || "").trim() || null,
              patient_sex: String(formData.get("patient_sex") || "").trim() || null,
              patient_age_band: String(formData.get("patient_age_band") || "").trim() || null,
              notes: String(formData.get("notes") || "").trim() || null,
              created_by: user.id,
              status: "draft",
            })
            .select("id")
            .maybeSingle();

          if (insErr || !data?.id) redirect(`/academy/trainees/${doctorId}/new-case`);
          redirect(`/academy/cases/${data.id}`);
        }}
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Surgery date *</label>
          <input name="surgery_date" type="date" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Procedure</label>
          <input name="procedure_type" placeholder="FUE" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Complexity</label>
            <input name="complexity_level" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Patient sex</label>
            <input name="patient_sex" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Patient age band</label>
          <input name="patient_age_band" placeholder="e.g. 30–40" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Notes</label>
          <textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
          Create case
        </button>
      </form>
    </div>
  );
}
