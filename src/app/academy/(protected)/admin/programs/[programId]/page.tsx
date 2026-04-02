import AdminProgramEditClient from "@/components/academy/admin/AdminProgramEditClient";

export const dynamic = "force-dynamic";

export default async function AdminProgramEditPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  return <AdminProgramEditClient programId={programId} />;
}
