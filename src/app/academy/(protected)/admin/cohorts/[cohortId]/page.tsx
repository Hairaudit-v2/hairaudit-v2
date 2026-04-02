import AdminCohortEditClient from "@/components/academy/admin/AdminCohortEditClient";

export const dynamic = "force-dynamic";

export default async function AdminCohortEditPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  return <AdminCohortEditClient cohortId={cohortId} />;
}
