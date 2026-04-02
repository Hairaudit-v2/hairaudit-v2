import AdminModuleEditClient from "@/components/academy/admin/AdminModuleEditClient";

export const dynamic = "force-dynamic";

export default async function AdminModuleEditPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  return <AdminModuleEditClient moduleId={decodeURIComponent(moduleId)} />;
}
