"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { ClaimValidationState } from "@/lib/nexus/claimTokenClient";
import { claimInvalidReasonMessageKey } from "@/lib/nexus/claimTokenClient";

type ClaimInvitePanelProps = {
  validation: ClaimValidationState;
  loginHref?: string;
  showSignInLink?: boolean;
};

function formatExpiry(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRoleLabel(role: string, t: (key: string) => string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "doctor") return t("auth.claim.roleDoctor");
  return role;
}

export default function ClaimInvitePanel({
  validation,
  loginHref = "/login",
  showSignInLink = true,
}: ClaimInvitePanelProps) {
  const { t, locale } = useI18n();

  if (validation.status === "idle") return null;

  if (validation.status === "loading") {
    return (
      <div
        className="mb-6 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-4"
        data-testid="claim-invite-panel"
        data-claim-state="loading"
      >
        <p className="text-sm text-slate-700">{t("auth.claim.validating")}</p>
      </div>
    );
  }

  if (validation.status === "invalid") {
    const messageKey = claimInvalidReasonMessageKey(validation.reason);
    return (
      <div
        className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4"
        data-testid="claim-invite-panel"
        data-claim-state={`invalid-${validation.reason}`}
      >
        <h2 className="text-sm font-semibold text-red-900">{t("auth.claim.invalidTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-red-800">{t(messageKey)}</p>
        <p className="mt-3 text-xs leading-relaxed text-red-700">{t("auth.claim.invalidHelp")}</p>
      </div>
    );
  }

  const { maskedEmail, role, expiresAt } = validation.validation;

  return (
    <div
      className="mb-6 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-4"
      data-testid="claim-invite-panel"
      data-claim-state="valid"
    >
      <h2 className="text-sm font-semibold text-violet-900">{t("auth.claim.validTitle")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{t("auth.claim.validBody")}</p>
      <dl className="mt-3 space-y-2 text-sm text-slate-700">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-slate-800">{t("auth.claim.intendedEmail")}</dt>
          <dd>{maskedEmail}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-slate-800">{t("auth.claim.roleLabel")}</dt>
          <dd>{formatRoleLabel(role, t)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-slate-800">{t("auth.claim.expiresLabel")}</dt>
          <dd>{formatExpiry(expiresAt, locale)}</dd>
        </div>
      </dl>
      {showSignInLink ? (
        <p className="mt-4 text-sm text-slate-600">
          {t("auth.claim.alreadyHaveAccount")}{" "}
          <Link href={loginHref} className="font-medium text-violet-700 hover:text-violet-900">
            {t("nav.signIn")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
