import AdminModulesClient from "@/components/academy/admin/AdminModulesClient";

export const dynamic = "force-dynamic";

export default function AdminLibraryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Training library (admin)</h1>
      <p className="text-sm text-slate-600">
        Database modules override JSON entries with the same id. Everyone still sees the merged catalog on{" "}
        <a href="/academy/training-modules" className="text-amber-800 font-medium hover:underline">
          Training library
        </a>
        .
      </p>
      <AdminModulesClient />
    </div>
  );
}
