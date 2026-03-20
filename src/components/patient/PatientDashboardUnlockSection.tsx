"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type UnlockDef = { id: string; unlockAt: number; icon: ReactNode };

const UNLOCK_DEFS: UnlockDef[] = [
  {
    id: "radar",
    unlockAt: 20,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" />
        <path d="M12 6a6 6 0 1 0 6 6" strokeLinecap="round" />
        <path d="M12 12l6-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "donor",
    unlockAt: 40,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "viability",
    unlockAt: 60,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2c3 4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-7 6-11z" strokeLinejoin="round" />
        <path d="M9.5 14.5c.5 1.5 2 2.5 3.5 2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "aesthetic",
    unlockAt: 80,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v18" strokeLinecap="round" />
        <path d="M6 7h12M6 17h12" strokeLinecap="round" />
        <path d="M8 7l-2 4 2 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 17l2-4-2-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "timeline",
    unlockAt: 100,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h18" strokeLinecap="round" />
        <path d="M7 12a5 5 0 0 1 10 0" strokeLinecap="round" />
        <path d="M12 12v7" strokeLinecap="round" />
        <path d="M9 19h6" strokeLinecap="round" />
      </svg>
    ),
  },
];

const TITLE_KEY = {
  radar: "dashboard.patient.unlock.radarTitle",
  donor: "dashboard.patient.unlock.donorTitle",
  viability: "dashboard.patient.unlock.viabilityTitle",
  aesthetic: "dashboard.patient.unlock.aestheticTitle",
  timeline: "dashboard.patient.unlock.timelineTitle",
} as const;

const DESC_KEY = {
  radar: "dashboard.patient.unlock.radarDesc",
  donor: "dashboard.patient.unlock.donorDesc",
  viability: "dashboard.patient.unlock.viabilityDesc",
  aesthetic: "dashboard.patient.unlock.aestheticDesc",
  timeline: "dashboard.patient.unlock.timelineDesc",
} as const;

export default function PatientDashboardUnlockSection({
  completionPct,
  nextCaseId,
}: {
  completionPct: number;
  nextCaseId: string | null;
}) {
  const { t } = useI18n();

  return (
    <section id="unlock-preview" className="scroll-mt-24 lg:col-span-7">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{t("dashboard.patient.unlock.sectionTitle")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-200/70">{t("dashboard.patient.unlock.sectionSubtitle")}</p>
        </div>
        {nextCaseId && (
          <div className="text-xs font-medium text-slate-200/70">
            {t("dashboard.patient.unlock.currentUnlock")}{" "}
            <span className="text-white">{completionPct}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {UNLOCK_DEFS.map((card) => {
          const unlocked = nextCaseId ? completionPct >= card.unlockAt : false;
          const tid = card.id as keyof typeof TITLE_KEY;
          return (
            <div
              key={card.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur"
            >
              <div className={`relative ${unlocked ? "" : "blur-[1.5px]"}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white shadow-sm">
                    {card.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t(TITLE_KEY[tid])}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-200/70">{t(DESC_KEY[tid])}</div>
                  </div>
                </div>
              </div>

              {!unlocked && (
                <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]">
                  <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-white">{t("dashboard.patient.unlock.locked")}</span>
                    <span className="text-xs font-medium text-slate-200/80">
                      {t("dashboard.patient.unlock.unlockAt").replace("{{pct}}", String(card.unlockAt))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
