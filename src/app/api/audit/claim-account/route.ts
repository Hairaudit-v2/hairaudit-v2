import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/audit/claim-account
 *
 * Email-collection step of the friction-free first audit ("Where should we send
 * your report?"). Upgrades the current ANONYMOUS user into a permanent account
 * — keeping the SAME uid, so the audit case ownership never changes — and
 * records the email + first name so the report-ready and verification emails
 * have a recipient.
 *
 * Does NOT send the verification email here: that is dispatched after report
 * generation (see the report-completion Inngest step), so value is delivered
 * before any friction.
 *
 * Body: { caseId: string, email: string, firstName?: string }
 */

const LOG_PREFIX = "[audit/claim-account]";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const caseId = typeof body?.caseId === "string" ? body.caseId.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const firstNameRaw = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const firstName = firstNameRaw ? firstNameRaw.slice(0, 120) : null;

  if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  // Identify the current (anonymous) user from their session.
  let supabaseAuth;
  try {
    supabaseAuth = await createSupabaseAuthServerClient();
  } catch (e) {
    console.error(LOG_PREFIX, "auth client failed", { error: e });
    return NextResponse.json({ ok: false, error: "Auth unavailable" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Your session has expired. Please start again." }, { status: 401 });
  }
  const userId = user.id;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    console.error(LOG_PREFIX, "admin client failed", { userId, error: e });
    return NextResponse.json({ ok: false, error: "Server configuration error" }, { status: 500 });
  }

  // Ownership: the current user must own this case.
  const { data: c, error: caseErr } = await admin
    .from("cases")
    .select("id, user_id, patient_id")
    .eq("id", caseId)
    .maybeSingle();
  if (caseErr) {
    console.error(LOG_PREFIX, "case lookup failed", { userId, caseId, error: caseErr.message });
    return NextResponse.json({ ok: false, error: "Could not load your audit." }, { status: 500 });
  }
  if (!c || (c.user_id !== userId && c.patient_id !== userId)) {
    return NextResponse.json({ ok: false, error: "Audit not found." }, { status: 404 });
  }

  // Upgrade anonymous user → permanent account (same uid; email left unconfirmed
  // so the verification email can be sent after report generation).
  const nextMetadata: Record<string, unknown> = {
    ...(user.user_metadata as Record<string, unknown> | undefined),
    role: "patient",
  };
  if (firstName) nextMetadata.first_name = firstName;

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    email,
    user_metadata: nextMetadata,
  });

  if (updateErr) {
    const msg = String(updateErr.message ?? "");
    console.error(LOG_PREFIX, "updateUserById failed", { userId, code: updateErr.code, error: msg });
    if (/already|registered|exists|duplicate/i.test(msg) || updateErr.code === "email_exists") {
      return NextResponse.json(
        { ok: false, error: "That email is already registered. Please sign in to continue.", code: "email_exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Could not save your email. Please try again." }, { status: 500 });
  }

  // Sync the patient profile row (created on anonymous sign-in by the
  // `on_auth_user_created` trigger with a null email) with the collected email
  // and name. The trigger only fires on INSERT, so the email-change UPDATE above
  // does not propagate to `profiles` on its own.
  const profilePatch: Record<string, unknown> = { id: userId, role: "patient", email };
  if (firstName) profilePatch.name = firstName;
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(profilePatch, { onConflict: "id" });
  if (profileErr) {
    // Non-fatal: account/email upgrade already succeeded.
    console.error(LOG_PREFIX, "profile upsert failed (non-fatal)", { userId, error: profileErr.message });
  }

  console.info(LOG_PREFIX, "anonymous account claimed", { userId, caseId });
  return NextResponse.json({ ok: true });
}
