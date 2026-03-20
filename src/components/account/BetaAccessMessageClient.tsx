"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function BetaAccessMessageClient() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader variant="minimal" />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">{t("account.betaAccess.title")}</h1>
          <p className="mt-6 leading-relaxed text-slate-700">{t("account.betaAccess.body1")}</p>
          <p className="mt-3 leading-relaxed text-slate-700">{t("account.betaAccess.body2")}</p>
          <p className="mt-3 leading-relaxed text-slate-700">{t("account.betaAccess.body3")}</p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {t("account.betaAccess.backToSignIn")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
