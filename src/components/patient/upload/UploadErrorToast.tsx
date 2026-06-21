"use client";

import { useEffect } from "react";

export type UploadToast = {
  id: string;
  message: string;
  variant?: "error" | "success" | "info";
};

export default function UploadErrorToast({
  toast,
  onDismiss,
  autoDismissMs = 6000,
}: {
  toast: UploadToast | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, autoDismissMs]);

  if (!toast) return null;

  const variant = toast.variant ?? "error";
  const styles =
    variant === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : variant === "info"
        ? "border-sky-300 bg-sky-50 text-sky-900"
        : "border-rose-300 bg-rose-50 text-rose-900";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${styles}`}
      >
        <p className="flex-1 leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
