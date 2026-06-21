"use client";

export default function UploadProgressBar({
  percent,
  label,
  className = "",
}: {
  percent: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={className}>
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-600">
          <span className="truncate">{label}</span>
          <span className="shrink-0 font-medium tabular-nums">{clamped}%</span>
        </div>
      ) : null}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Upload progress"}
      >
        <div
          className="h-full rounded-full bg-cyan-600 transition-all duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
