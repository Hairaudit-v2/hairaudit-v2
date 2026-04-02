import AdminProgramsClient from "@/components/academy/admin/AdminProgramsClient";

export const dynamic = "force-dynamic";

export default function AdminProgramsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Programs</h1>
      <AdminProgramsClient />
    </div>
  );
}
