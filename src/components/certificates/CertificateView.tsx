/**
 * Certificate view: full-page or modal-friendly layout using renderCertificate().
 * Static v1: display-only. Supports print styles.
 */

"use client";

import { renderCertificate } from "@/lib/certificates/renderCertificate";
import type { CertificateData } from "@/lib/certificates/types";

type CertificateViewProps = {
  data: CertificateData;
  /** fullPage: centered A4-style layout for dedicated page; modal: compact for dialogs */
  variant?: "fullPage" | "modal";
  /** Optional: show Download PDF placeholder button */
  showDownloadPlaceholder?: boolean;
};

export default function CertificateView({
  data,
  variant = "fullPage",
  showDownloadPlaceholder = false,
}: CertificateViewProps) {
  const isFullPage = variant === "fullPage";

  return (
    <div
      className={
        isFullPage
          ? "min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 print:p-0 bg-stone-100 print:bg-white"
          : "flex flex-col items-center p-4 max-h-[90vh] overflow-auto"
      }
    >
      <div
        className={
          isFullPage
            ? "w-full max-w-[210mm] flex flex-col items-center print:max-w-none"
            : "w-full max-w-[min(100%,420px)]"
        }
      >
        {renderCertificate(data)}
      </div>
      {showDownloadPlaceholder && (
        <div className="mt-6 print:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-500 text-slate-400 text-sm font-medium cursor-not-allowed"
            disabled
            title="PDF export coming soon"
          >
            Download PDF (coming soon)
          </button>
        </div>
      )}
    </div>
  );
}
