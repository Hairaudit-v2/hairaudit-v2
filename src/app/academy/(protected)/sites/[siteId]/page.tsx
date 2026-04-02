import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { ACADEMY_ADMIN_FORBIDDEN_PATH, getAcademyAccess, isAcademyAdminRole } from "@/lib/academy/auth";
import { getAcademySiteById } from "@/lib/academy/academySites";
import AcademySiteEditForm from "./AcademySiteEditForm";

export const dynamic = "force-dynamic";

export default async function AcademySiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (!isAcademyAdminRole(access.role)) redirect(ACADEMY_ADMIN_FORBIDDEN_PATH);

  const { siteId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const site = await getAcademySiteById(supabase, siteId);
  if (!site) notFound();

  const { data: linkedPrograms } = await supabase
    .from("training_programs")
    .select("id, name")
    .eq("academy_site_id", siteId)
    .order("name", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/academy/sites" className="text-sm font-medium text-amber-700 hover:underline">
          ← Academy sites
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{site.display_name?.trim() || site.name}</h1>
        <p className="mt-1 text-sm text-slate-500 font-mono">{site.slug}</p>
      </div>

      {linkedPrograms && linkedPrograms.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked programs</h2>
          <ul className="mt-2 space-y-1 text-slate-700">
            {linkedPrograms.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <AcademySiteEditForm site={site} />
    </div>
  );
}
