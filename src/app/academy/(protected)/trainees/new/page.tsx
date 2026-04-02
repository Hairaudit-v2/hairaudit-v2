import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { DEFAULT_TRAINING_PROGRAM_ID } from "@/lib/academy/constants";

export const dynamic = "force-dynamic";

export default async function NewTraineePage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!access.isStaff) redirect("/academy/dashboard");

  const supabase = await createSupabaseAuthServerClient();
  const [{ data: programs }, { data: sites }, { data: trainerRows }] = await Promise.all([
    supabase.from("training_programs").select("id, name, is_active").order("name"),
    supabase.from("academy_sites").select("id, name, display_name").order("name"),
    supabase.from("academy_users").select("user_id, display_name, email").eq("role", "trainer").order("display_name"),
  ]);

  const programList = (programs ?? []).filter((p: { is_active?: boolean }) => p.is_active !== false);
  const siteList = ((sites ?? []) as { id: string; name: string; display_name: string | null }[]).map((s) => ({
    id: s.id,
    label: s.display_name?.trim() || s.name,
  }));
  const trainerList = ((trainerRows ?? []) as { user_id: string; display_name: string | null; email: string | null }[]).map(
    (t) => ({
      user_id: t.user_id,
      label: t.display_name?.trim() || t.email || t.user_id.slice(0, 8),
    })
  );

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/academy/trainees" className="text-sm font-medium text-amber-700 hover:underline">
          ← Trainees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">New trainee</h1>
        <p className="mt-1 text-sm text-slate-600">Program, site override, trainer, and wave start — then add cases.</p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          const a = await getAcademyAccess();
          if (!a.ok || !a.isStaff) redirect("/academy/dashboard");

          const full_name = String(formData.get("full_name") || "").trim();
          if (!full_name) redirect("/academy/trainees/new?error=name");

          const supabase = await createSupabaseAuthServerClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) redirect("/academy/login");

          const program_id = String(formData.get("program_id") || "").trim() || DEFAULT_TRAINING_PROGRAM_ID;

          const { data, error } = await supabase
            .from("training_doctors")
            .insert({
              full_name,
              email: String(formData.get("email") || "").trim() || null,
              phone: String(formData.get("phone") || "").trim() || null,
              country: String(formData.get("country") || "").trim() || null,
              clinic_name: String(formData.get("clinic_name") || "").trim() || null,
              registration_number: String(formData.get("registration_number") || "").trim() || null,
              start_date: String(formData.get("start_date") || "").trim() || null,
              competency_wave_start_date: String(formData.get("competency_wave_start_date") || "").trim() || null,
              program_id,
              academy_site_id: String(formData.get("academy_site_id") || "").trim() || null,
              assigned_trainer_id: String(formData.get("assigned_trainer_id") || "").trim() || null,
              current_stage: String(formData.get("current_stage") || "").trim() || "foundation",
              status: String(formData.get("status") || "").trim() || "active",
              notes: String(formData.get("notes") || "").trim() || null,
              auth_user_id: String(formData.get("auth_user_id") || "").trim() || null,
              created_by: user.id,
            })
            .select("id")
            .maybeSingle();

          if (error || !data?.id) redirect("/academy/trainees/new?error=save");
          redirect(`/academy/trainees/${data.id}`);
        }}
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Full name *</label>
          <input name="full_name" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input name="email" type="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Phone</label>
            <input name="phone" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Country</label>
            <input name="country" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Clinic</label>
            <input name="clinic_name" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Registration #</label>
          <input name="registration_number" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Start date</label>
            <input name="start_date" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Competency wave start</label>
            <input name="competency_wave_start_date" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Program</label>
            <select name="program_id" defaultValue={DEFAULT_TRAINING_PROGRAM_ID} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {programList.length === 0 ? (
                <option value={DEFAULT_TRAINING_PROGRAM_ID}>Standard FUE Academy</option>
              ) : (
                programList.map((p: { id: string; name: string }) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Academy site override</label>
            <select name="academy_site_id" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— Inherit from program —</option>
              {siteList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Assigned trainer</label>
          <select name="assigned_trainer_id" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— None —</option>
            {trainerList.map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Current stage</label>
            <input name="current_stage" defaultValue="foundation" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Status</label>
            <select name="status" defaultValue="active" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="graduated">graduated</option>
              <option value="withdrawn">withdrawn</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Linked auth user id (trainee login)</label>
          <input name="auth_user_id" placeholder="UUID" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Trainer notes</label>
          <textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
          Create trainee
        </button>
      </form>
    </div>
  );
}
