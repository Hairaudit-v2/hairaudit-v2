"use client";

export default function CaptureReferencePanel({
  available,
  url,
  label,
  matchNote,
  viewLabel,
}: {
  available: boolean;
  url: string | null;
  label: string | null;
  matchNote: string;
  viewLabel: string;
}) {
  if (!available || !url) return null;

  return (
    <figure
      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      data-testid="guided-capture-reference"
    >
      <figcaption className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
        Reference{label ? ` · ${label}` : ""}
      </figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Reference photo for ${viewLabel}. ${matchNote}`}
        className="max-h-56 w-full object-contain bg-white"
      />
      <p className="px-3 py-2 text-sm text-slate-700">{matchNote}</p>
    </figure>
  );
}
