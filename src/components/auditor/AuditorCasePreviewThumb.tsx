"use client";

type Props = {
  url: string | null | undefined;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS = {
  sm: "h-14 w-14",
  md: "h-20 w-20",
  lg: "h-28 w-28",
} as const;

/**
 * Compact case photo chip for the auditor operations desk.
 */
export default function AuditorCasePreviewThumb({ url, label = "Case preview", size = "md" }: Props) {
  const box = SIZE_CLASS[size];
  if (!url) {
    return (
      <div
        className={`${box} shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-100 text-[10px] font-medium uppercase tracking-wide text-slate-500 flex items-center justify-center text-center px-1`}
        aria-label="No preview photo"
      >
        No photo
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
    <img
      src={url}
      alt={label}
      className={`${box} shrink-0 rounded-lg border border-slate-200 object-cover bg-slate-100`}
      loading="lazy"
    />
  );
}
