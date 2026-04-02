import AdminPeopleClient from "@/components/academy/admin/AdminPeopleClient";

export const dynamic = "force-dynamic";

export default function AdminPeoplePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">People</h1>
      <p className="text-sm text-slate-600">
        Trainers, clinic coordinators / nurses, and trainees. Backend role for coordinators remains{" "}
        <code className="text-xs bg-slate-100 px-1 rounded">clinic_staff</code>.
      </p>
      <AdminPeopleClient />
    </div>
  );
}
