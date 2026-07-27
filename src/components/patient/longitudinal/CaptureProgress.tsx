"use client";

import type { GuidedCaptureProgressDto } from "@/lib/outcomeIntelligence/guidedCaptureDto";

export default function CaptureProgress({
  progress,
  title,
}: {
  progress: GuidedCaptureProgressDto;
  title?: string;
}) {
  const requiredLabel = `${progress.requiredComplete} of ${progress.requiredTotal} required views complete`;
  const recommendedLabel =
    progress.recommendedTotal > 0
      ? `${progress.recommendedComplete} of ${progress.recommendedTotal} recommended added`
      : null;

  return (
    <div
      className="space-y-2"
      data-testid="guided-capture-progress"
      role="status"
      aria-live="polite"
      aria-label={
        recommendedLabel ? `${requiredLabel}. ${recommendedLabel}.` : requiredLabel
      }
    >
      {title ? (
        <p className="text-sm font-medium text-slate-700">{title}</p>
      ) : null}
      <div className="flex items-center gap-2 text-sm text-slate-800">
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-slate-700" />
        <span>
          Required photos{" "}
          <strong>
            {progress.requiredComplete} / {progress.requiredTotal}
          </strong>{" "}
          complete
        </span>
      </div>
      {progress.recommendedTotal > 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-slate-400" />
          <span>
            Recommended{" "}
            <strong>
              {progress.recommendedComplete} / {progress.recommendedTotal}
            </strong>{" "}
            added
          </span>
        </div>
      ) : null}
    </div>
  );
}
