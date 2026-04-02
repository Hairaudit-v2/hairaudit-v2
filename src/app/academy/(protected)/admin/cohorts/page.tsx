import AdminCohortsClient from "@/components/academy/admin/AdminCohortsClient";

export const dynamic = "force-dynamic";

export default function AdminCohortsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Cohorts / intakes</h1>
      <p className="text-sm text-slate-600">Group a site, program, trainers, and trainees for reporting and module assignments.</p>
      <AdminCohortsClient />
    </div>
  );
}
