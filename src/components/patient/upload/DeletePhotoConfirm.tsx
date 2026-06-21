"use client";

export default function DeletePhotoConfirm({
  onConfirm,
  onCancel,
  busy,
  className = "",
}: {
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${className}`}
      role="alertdialog"
      aria-labelledby="delete-photo-confirm-title"
    >
      <p id="delete-photo-confirm-title" className="font-medium">
        Remove this photo?
      </p>
      <p className="mt-1 text-xs text-amber-900/80">
        You can upload a replacement anytime before you submit your case.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {busy ? "Removing…" : "Yes, remove"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Keep photo
        </button>
      </div>
    </div>
  );
}
