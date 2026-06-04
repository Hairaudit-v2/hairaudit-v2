import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { SURGERY_PROCEDURE_TYPES } from "@/lib/surgeryUpload/fields";
import { parseAuditIntakeSearchParams } from "@/lib/surgeryUpload/auditIntakeListParams";
import { loadAuditIntakeQueue } from "@/lib/surgeryUpload/auditIntakeQuery";
import AuditIntakeQueueClient from "./AuditIntakeQueueClient";

export const dynamic = "force-dynamic";

const PROCEDURE_LABELS = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

export default async function SurgeryUploadAuditIntakePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await resolveSurgeryUploadActor(user);
  // Auditor/admin only. Clinics/doctors/patients can never manage the intake queue.
  if (!actor.isAuditor) redirect("/dashboard/surgery-upload");

  const admin = createSupabaseAdminClient();
  const params = parseAuditIntakeSearchParams(await Promise.resolve(searchParams ?? {}));
  const result = await loadAuditIntakeQueue({ admin, params });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24">
      <header className="pt-2">
        <Link
          href="/dashboard/surgery-upload"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← All surgery uploads
        </Link>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-cyan-700">
          HairAudit
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Audit intake queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Mobile surgery uploads that have been handed off for audit. This is a controlled
          intake layer — processing or completing a record here does not yet generate an
          audit report.
        </p>
      </header>

      <AuditIntakeQueueClient
        rows={result.rows}
        options={result.options}
        filters={params}
        page={result.page}
        pageSize={result.pageSize}
        totalCount={result.totalCount}
        totalCountApproximate={result.totalCountApproximate}
        hasPrevPage={result.hasPrevPage}
        hasNextPage={result.hasNextPage}
        totalPages={result.totalPages}
        procedureLabels={PROCEDURE_LABELS}
      />
    </div>
  );
}
