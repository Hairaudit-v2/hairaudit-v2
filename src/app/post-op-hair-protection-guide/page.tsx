import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PatientLongTermGuideSections from "@/components/patient/PatientLongTermGuideSections";
import { buildPatientLongTermGuidePdfHref, PATIENT_LONG_TERM_GUIDE_PRINT_PATH } from "@/lib/constants/patientGuide";
import {
  canUnlockPostOpGuide,
  firstCaseOpenForSubmit,
  patientHasUnlockedPostOpGuide,
} from "@/lib/patient/caseSubmitStatus";
import { fetchPatientCasesForPostOpGuide } from "@/lib/patient/fetchPatientCasesForPostOpGuide";
import { buildPatientLongTermGuideContent } from "@/lib/reports/patientLongTermGuide";
import { getTranslation } from "@/lib/i18n/getTranslation";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { createLocalizedPageMetadata, resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolvePublicSeoLocale();
  return createLocalizedPageMetadata(locale, {
    titleKey: "marketing.meta.postOpHairProtectionGuide.title",
    descriptionKey: "marketing.meta.postOpHairProtectionGuide.description",
    pathname: "/post-op-hair-protection-guide",
  });
}

export default async function PostOpHairProtectionGuidePage() {
  const locale = await resolvePublicSeoLocale();
  const t = (key: TranslationKey) => getTranslation(key, locale);

  const supabaseAuth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  let unlocked = false;
  let submitCtaHref = "/request-review";
  let progressHref = "/dashboard/patient";

  if (user) {
    const admin = createSupabaseAdminClient();
    const cases = await fetchPatientCasesForPostOpGuide(admin, user.id);
    unlocked = patientHasUnlockedPostOpGuide(cases);
    const openSubmitCase = firstCaseOpenForSubmit(
      cases.map((c) => ({
        id: c.id,
        status: c.status,
        submitted_at: c.submitted_at,
      }))
    );
    submitCtaHref = openSubmitCase ? `/cases/${openSubmitCase.id}` : "/request-review";
    const latestEligible = cases.find((c) => canUnlockPostOpGuide(c));
    progressHref = latestEligible ? `/cases/${latestEligible.id}` : "/dashboard/patient";
  }

  const guidePdf = buildPatientLongTermGuidePdfHref(locale);
  const coverBullets = ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"] as const;
  const guideContent = buildPatientLongTermGuideContent(locale);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <header className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
              {t("marketing.postOpHairProtectionGuide.hero.eyebrow")}
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {t("marketing.postOpHairProtectionGuide.hero.title")}
            </h1>
            <p className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-amber-200/90">
              {unlocked
                ? t("marketing.postOpHairProtectionGuide.hero.badgeUnlocked")
                : t("marketing.postOpHairProtectionGuide.hero.badgeLocked")}
            </p>
            <p className="mt-5 text-slate-300 leading-relaxed text-base">
              {unlocked
                ? t("marketing.postOpHairProtectionGuide.hero.subtitleUnlocked")
                : t("marketing.postOpHairProtectionGuide.hero.subtitleLocked")}
            </p>
          </header>

          <section className="mt-14" aria-labelledby="po-guide-what">
            <h2 id="po-guide-what" className="text-lg font-semibold text-white">
              {t("marketing.postOpHairProtectionGuide.whatItIs.title")}
            </h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              {t("marketing.postOpHairProtectionGuide.whatItIs.body")}
            </p>
          </section>

          <section className="mt-12" aria-labelledby="po-guide-covers">
            <h2 id="po-guide-covers" className="text-lg font-semibold text-white">
              {t("marketing.postOpHairProtectionGuide.covers.title")}
            </h2>
            <ul className="mt-4 space-y-3 text-slate-300">
              {coverBullets.map((k) => (
                <li key={k} className="flex gap-3">
                  <span className="text-amber-400/90 shrink-0" aria-hidden>
                    ✓
                  </span>
                  {t(`marketing.postOpHairProtectionGuide.covers.${k}` as TranslationKey)}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12" aria-labelledby="po-guide-why">
            <h2 id="po-guide-why" className="text-lg font-semibold text-white">
              {t("marketing.postOpHairProtectionGuide.whyMatters.title")}
            </h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              {t("marketing.postOpHairProtectionGuide.whyMatters.body")}
            </p>
          </section>

          <section className="mt-12" aria-labelledby="po-guide-content">
            <h2 id="po-guide-content" className="text-lg font-semibold text-white">
              {unlocked
                ? t("marketing.postOpHairProtectionGuide.fullGuide.titleUnlocked")
                : t("marketing.postOpHairProtectionGuide.fullGuide.titleLocked")}
            </h2>
            {!unlocked ? (
              <p className="mt-3 text-sm text-slate-500">
                {t("marketing.postOpHairProtectionGuide.fullGuide.lockedHint")}
              </p>
            ) : null}
            <div className={`relative mt-5 ${unlocked ? "" : "overflow-hidden"}`}>
              <div className={unlocked ? "" : "opacity-40 blur-[1px] select-none pointer-events-none"}>
                <PatientLongTermGuideSections content={guideContent} />
              </div>
            </div>
          </section>

          <section
            className="mt-14 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-slate-900/60 p-6 sm:p-8"
            aria-labelledby="po-guide-access"
          >
            <h2 id="po-guide-access" className="text-xl font-semibold text-white">
              {unlocked
                ? t("marketing.postOpHairProtectionGuide.access.unlockedTitle")
                : t("marketing.postOpHairProtectionGuide.access.lockedTitle")}
            </h2>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              {unlocked
                ? t("marketing.postOpHairProtectionGuide.access.unlockedBody")
                : t("marketing.postOpHairProtectionGuide.access.lockedBody")}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              {unlocked ? (
                <a
                  href={guidePdf}
                  download
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400/90 to-amber-500/90 px-5 py-3 text-sm font-semibold text-slate-950 hover:from-amber-300 hover:to-amber-400 transition-colors"
                >
                  {t("marketing.postOpHairProtectionGuide.access.downloadCta")}
                </a>
              ) : (
                <Link
                  href={submitCtaHref}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:from-cyan-200 hover:to-emerald-200 transition-colors"
                >
                  {t("marketing.postOpHairProtectionGuide.access.lockedCta")}
                </Link>
              )}
              {unlocked ? (
                <>
                  <Link
                    href="/dashboard/patient"
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/10 transition-colors"
                  >
                    {t("marketing.postOpHairProtectionGuide.access.secondaryDashboard")}
                  </Link>
                  <Link
                    href={progressHref}
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/10 transition-colors"
                  >
                    {t("marketing.postOpHairProtectionGuide.access.secondaryProgress")}
                  </Link>
                </>
              ) : null}
            </div>
          </section>

          <p className="mt-12 text-xs text-slate-500 leading-relaxed border-t border-white/10 pt-8">
            {t("marketing.postOpHairProtectionGuide.disclaimer")}
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
