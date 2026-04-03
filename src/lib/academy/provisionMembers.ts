import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCanonicalAppUrl } from "@/lib/auth/redirects";
import { sendEmail } from "@/lib/email";
import { DEFAULT_TRAINING_PROGRAM_ID } from "./constants";
import type { AcademyUserRole } from "./constants";
import type { UserRole } from "@/lib/roles";

export type ProvisionAcademyRole = "trainer" | "clinic_staff" | "trainee";

export type ProvisionOneResult = {
  email: string;
  academy_role: ProvisionAcademyRole;
  ok: boolean;
  method?: "invite" | "magic_link";
  error?: string;
  /** When email could not be sent (e.g. missing Resend), magic link for manual sharing */
  manualLink?: string;
};

/**
 * HairAudit `profiles.role` drives the main app (patient / doctor / clinic dashboards).
 * Academy permissions come from `academy_users.role` — do not map trainers to `doctor` by default,
 * or they are treated as HairAudit surgeon users and routed to /dashboard/doctor.
 * New trainers get `patient` unless they already have doctor/clinic/auditor (see resolveProfileRoleForUpsert).
 */
function hairAuditProfileRoleFor(academyRole: ProvisionAcademyRole): UserRole {
  if (academyRole === "trainer") return "patient";
  if (academyRole === "clinic_staff") return "clinic";
  return "patient";
}

function academyUserRoleFor(academyRole: ProvisionAcademyRole): AcademyUserRole {
  if (academyRole === "trainer") return "trainer";
  if (academyRole === "clinic_staff") return "clinic_staff";
  return "trainee";
}

async function resolveProfileRoleForUpsert(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  desired: UserRole
): Promise<UserRole> {
  const { data: existing } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const r = existing?.role as string | undefined;
  if (r === "doctor" || r === "clinic" || r === "auditor") return r as UserRole;
  return desired;
}

/** GoTrue / invite errors when the email already has an auth user — wording varies by version. */
function isAuthEmailAlreadyRegisteredMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already registered") ||
    m.includes("email address is already") ||
    m.includes("email already") ||
    (m.includes("already") && m.includes("exists") && m.includes("user"))
  );
}

/** ILIKE pattern for case-insensitive exact email match (escape %, _, \\). */
function emailForExactIlike(e: string): string {
  return e.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Invite or magic-link a user, upsert HairAudit profile + academy_users, optional training_doctors for trainees.
 */
export async function provisionAcademyMember(input: {
  email: string;
  academyRole: ProvisionAcademyRole;
  displayName?: string | null;
  invitedByUserId: string;
}): Promise<ProvisionOneResult> {
  const admin = createSupabaseAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { email, academy_role: input.academyRole, ok: false, error: "Invalid email" };
  }

  const redirectTo = `${getCanonicalAppUrl()}/auth/callback?next=${encodeURIComponent("/academy/dashboard")}`;
  const desiredProfileRole = hairAuditProfileRoleFor(input.academyRole);
  const acadRole = academyUserRoleFor(input.academyRole);
  const display =
    (input.displayName && input.displayName.trim()) || email.split("@")[0] || "Academy user";

  const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: desiredProfileRole },
  });

  let userId: string | null = inviteRes.data?.user?.id ?? null;
  let method: "invite" | "magic_link" = "invite";
  let manualLink: string | undefined;

  if (inviteRes.error) {
    if (!isAuthEmailAlreadyRegisteredMessage(inviteRes.error.message)) {
      return { email, academy_role: input.academyRole, ok: false, error: inviteRes.error.message };
    }

    const linkRes = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (linkRes.error || !linkRes.data?.user?.id) {
      return {
        email,
        academy_role: input.academyRole,
        ok: false,
        error: linkRes.error?.message ?? "Could not generate sign-in link for existing user",
      };
    }

    userId = linkRes.data.user.id;
    method = "magic_link";
    const actionLink = linkRes.data.properties?.action_link;
    if (actionLink) {
      const sent = await sendEmail({
        to: email,
        subject: "IIOHR Academy — your sign-in link",
        html: `
          <p>You have been granted access to the <strong>IIOHR Academy</strong> on HairAudit.</p>
          <p><a href="${actionLink}">Sign in to the Academy</a> (link expires; use Forgot password on the login page if it expires).</p>
          <p>— HairAudit / IIOHR</p>
        `,
      });
      if (!sent) manualLink = actionLink;
    }
  }

  if (!userId) {
    return { email, academy_role: input.academyRole, ok: false, error: "No user id after invite/link" };
  }

  const profileRole = await resolveProfileRoleForUpsert(admin, userId, desiredProfileRole);
  const now = new Date().toISOString();

  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      role: profileRole,
      email,
      name: display,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (pErr) {
    return { email, academy_role: input.academyRole, ok: false, error: `Profile: ${pErr.message}` };
  }

  const { error: aErr } = await admin.from("academy_users").upsert(
    {
      user_id: userId,
      role: acadRole,
      display_name: display,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (aErr) {
    return { email, academy_role: input.academyRole, ok: false, error: `Academy user: ${aErr.message}` };
  }

  if (input.academyRole === "trainee") {
    const { data: linkedRows, error: linkedErr } = await admin
      .from("training_doctors")
      .select("id")
      .eq("auth_user_id", userId)
      .limit(1);
    if (linkedErr) {
      return {
        email,
        academy_role: input.academyRole,
        ok: false,
        error: `Trainee profile: ${linkedErr.message}`,
      };
    }
    if (linkedRows?.length) {
      // Already linked to a trainee row
    } else {
      const { data: shellRows, error: shErr } = await admin
        .from("training_doctors")
        .select("id")
        .is("auth_user_id", null)
        .ilike("email", emailForExactIlike(email))
        .order("created_at", { ascending: true })
        .limit(1);
      if (shErr) {
        return {
          email,
          academy_role: input.academyRole,
          ok: false,
          error: `Trainee profile: ${shErr.message}`,
        };
      }
      const shellId = shellRows?.[0]?.id as string | undefined;

      if (shellId) {
        const { error: upErr } = await admin
          .from("training_doctors")
          .update({
            auth_user_id: userId,
            full_name: display,
            email,
            updated_at: now,
          })
          .eq("id", shellId);
        if (upErr) {
          return {
            email,
            academy_role: input.academyRole,
            ok: false,
            error: `Trainee profile: ${upErr.message}`,
          };
        }
      } else {
        const { error: tdErr } = await admin.from("training_doctors").insert({
          full_name: display,
          email,
          auth_user_id: userId,
          created_by: input.invitedByUserId,
          program_id: DEFAULT_TRAINING_PROGRAM_ID,
          current_stage: "foundation",
          status: "active",
        });
        if (tdErr) {
          return {
            email,
            academy_role: input.academyRole,
            ok: false,
            error: `Trainee profile: ${tdErr.message}`,
          };
        }
      }
    }
  }

  return {
    email,
    academy_role: input.academyRole,
    ok: true,
    method,
    manualLink,
  };
}
