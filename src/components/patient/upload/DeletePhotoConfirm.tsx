"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

export default function DeletePhotoConfirm({
  onConfirm,
  onCancel,
  busy,
  className = "",
  patientCopy = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
  patientCopy?: boolean;
}) {
  const { t } = useI18n();

  const title = patientCopy
    ? t("patient.upload.deleteConfirm.title" as TranslationKey)
    : "Remove this photo?";
  const body = patientCopy
    ? t("patient.upload.deleteConfirm.body" as TranslationKey)
    : "You can upload a replacement anytime before you submit your case.";
  const confirmLabel = busy
    ? patientCopy
      ? t("patient.upload.deleteConfirm.confirmBusy" as TranslationKey)
      : "Removing…"
    : patientCopy
      ? t("patient.upload.deleteConfirm.confirm" as TranslationKey)
      : "Yes, remove";
  const cancelLabel = patientCopy
    ? t("patient.upload.deleteConfirm.cancel" as TranslationKey)
    : "Keep photo";

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${className}`}
      role="alertdialog"
      aria-labelledby="delete-photo-confirm-title"
    >
      <p id="delete-photo-confirm-title" className="font-medium">
        {title}
      </p>
      <p className="mt-1 text-xs text-amber-900/80">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
