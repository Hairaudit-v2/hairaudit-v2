"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function DeleteDraftCaseButton({
  caseId,
  caseTitle,
  className = "",
}: {
  caseId: string;
  caseTitle?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;

        const confirmMsg = caseTitle?.trim()
          ? t("dashboard.patient.deleteDraft.confirmNamed").replace("{{title}}", caseTitle.trim())
          : t("dashboard.patient.deleteDraft.confirmUnnamed");
        const ok = window.confirm(confirmMsg);
        if (!ok) return;

        setBusy(true);
        try {
          const res = await fetch(`/api/cases/delete?caseId=${encodeURIComponent(caseId)}`, { method: "DELETE" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(typeof json?.error === "string" ? json.error : t("dashboard.patient.deleteDraft.errorGeneric"));
            return;
          }
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={
        "inline-flex items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-300/15 disabled:opacity-60 disabled:cursor-not-allowed transition-colors " +
        className
      }
      aria-label={t("dashboard.patient.deleteDraft.ariaLabel")}
    >
      {busy ? t("dashboard.patient.deleteDraft.busy") : t("dashboard.patient.deleteDraft.button")}
    </button>
  );
}

