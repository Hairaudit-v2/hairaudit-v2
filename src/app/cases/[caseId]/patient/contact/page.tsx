import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";
import PatientContactClient from "./PatientContactClient";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import {
  isAnonymousAuthUser,
  logIntakeAuthDiagnostic,
  patientContactReturnPath,
  redeemIntakeCaseHandoff,
} from "@/lib/patient/intakeCaseOwnership";
import { isMalformedIntakeHandoffToken } from "@/lib/patient/intakeCaseHandoffToken";
import {
  isPatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

/**
 * Account confirmation step (HA-AUTH-HANDOFF-FIX).
 * Server auth is the source of truth; handoff tokens attach ownership after
 * existing-account sign-in before rendering the form.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ handoff?: string }>;
}) {
  const { caseId } = await params;
  const sp = await searchParams;
  const handoffToken =
    typeof sp.handoff === "string" && !isMalformedIntakeHandoffToken(sp.handoff) ? sp.handoff.trim() : null;

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logIntakeAuthDiagnostic({
      authStateSource: "server_getUser",
      caseId,
      ownershipResult: "no_session",
      redirectReason: "contact_requires_auth",
      intendedReturnRoute: patientContactReturnPath(caseId, handoffToken),
    });
    redirect(buildPatientLoginHref(patientContactReturnPath(caseId, handoffToken)));
  }

  const anonymous = isAnonymousAuthUser(user);

  // Prefer admin for handoff redeem + ownership checks (SSR cookie is still source of user id).
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  if (handoffToken && admin && !anonymous) {
    const redeemed = await redeemIntakeCaseHandoff({
      admin,
      plaintextToken: handoffToken,
      claimantUserId: user.id,
      claimantEmail: user.email,
    });
    logIntakeAuthDiagnostic({
      authStateSource: "handoff_redeem",
      authenticatedUserId: user.id,
      caseId,
      ownershipResult: redeemed.ok ? (redeemed.transferred ? "transferred" : "already_owned") : redeemed.code,
      correlationId: redeemed.correlationId,
      intendedReturnRoute: redeemed.ok ? redeemed.returnPath : null,
      isAnonymous: false,
    });
    if (redeemed.ok) {
      redirect(`/cases/${caseId}/patient/contact`);
    }
  }

  const { data: c } = await supabase
    .from("cases")
    .select("id, user_id, patient_id, patient_review_pathway")
    .eq("id", caseId)
    .maybeSingle();

  if (!c) {
    return (
      <CaseNotFoundRecovery
        dashboardHref="/dashboard/patient"
        startNewHref="/request-review"
        showExistingCasesLink
        existingCasesHref="/dashboard/patient"
      />
    );
  }

  const allowed = c.user_id === user.id || c.patient_id === user.id;
  if (!allowed) {
    // Registered user without ownership and without redeemable handoff — do not dump silently.
    if (handoffToken) {
      logIntakeAuthDiagnostic({
        authStateSource: "server_getUser",
        authenticatedUserId: user.id,
        caseId,
        ownershipResult: "handoff_failed_not_owner",
        redirectReason: "stay_on_contact_with_client_redeem",
        isAnonymous: anonymous,
      });
      // Let the client attempt redeem / show error (token may need browser session sync).
    } else {
      logIntakeAuthDiagnostic({
        authStateSource: "server_getUser",
        authenticatedUserId: user.id,
        caseId,
        ownershipResult: "not_owner",
        redirectReason: "dashboard_patient",
        isAnonymous: anonymous,
      });
      redirect("/dashboard/patient");
    }
  }

  const pathway: PatientReviewPathway = isPatientReviewPathway(c.patient_review_pathway)
    ? c.patient_review_pathway
    : "post_surgery";

  logIntakeAuthDiagnostic({
    authStateSource: "server_getUser",
    authenticatedUserId: user.id,
    caseId,
    pathway,
    ownershipResult: allowed ? "owner" : "pending_handoff",
    isAnonymous: anonymous,
    emailMatched: null,
  });

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <PatientContactClient
        caseId={caseId}
        pathway={pathway}
        handoffToken={allowed ? null : handoffToken}
        sessionEmail={user.email ?? null}
        isAnonymous={anonymous}
      />
    </div>
  );
}
