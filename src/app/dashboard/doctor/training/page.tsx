import { DoctorTrainingRecommendations } from "@/components/doctor-portal/DoctorPortalDemo";
import { trainingModulesDemo } from "@/lib/doctorPortal/demoData";

export default function DoctorTrainingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Doctor Training Portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Training recommendations sync with weak audit domains so improvement work is directly tied to outcomes.
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {trainingModulesDemo.map((module) => (
          <article key={module.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{module.title}</h2>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  module.locked ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {module.locked ? "Locked" : "Unlocked"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {module.domain.replaceAll("_", " ")} - {module.level} - {module.estMinutes} min
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {module.premium ? "Premium upsell module with payment-ready placeholder architecture." : "Included learning pathway."}
            </p>
          </article>
        ))}
      </section>
      <DoctorTrainingRecommendations />
    </div>
  );
}
