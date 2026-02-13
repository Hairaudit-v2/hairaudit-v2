import Link from "next/link";
import { redirect } from "next/navigation";
import PatientAuditFormClient from "./PatientAuditFormClient";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export default async function Page({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at")
    .eq("id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!c) redirect("/dashboard");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/cases/${caseId}`}
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to case
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Patient Audit Form
      </h1>
      <p className="text-gray-600 mb-8">
        Please complete this form about your hair transplant experience. It takes about 5–10 minutes.
      </p>

      <PatientAuditFormClient
        caseId={caseId}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
      />
    </div>
  );
}
