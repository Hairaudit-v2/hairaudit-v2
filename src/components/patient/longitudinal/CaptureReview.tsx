"use client";

import type {
  GuidedCaptureViewDto,
  GuidedLongitudinalCaptureDto,
} from "@/lib/outcomeIntelligence/guidedCaptureDto";
import CaptureProgress from "./CaptureProgress";

export default function CaptureReview({
  dto,
  onSelectView,
  onFinish,
}: {
  dto: GuidedLongitudinalCaptureDto;
  onSelectView: (view: GuidedCaptureViewDto) => void;
  onFinish: () => void;
}) {
  const required = dto.views.filter((v) => v.required);
  const recommended = dto.views.filter((v) => !v.required);
  const canFinish = required.every((v) => v.complete);

  return (
    <section className="space-y-5" data-testid="guided-capture-review">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Your follow-up photos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review your uploads. You can replace any photo before finishing.
        </p>
      </div>

      <CaptureProgress progress={dto.progress} />

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Required
        </h3>
        <ul className="mt-2 space-y-2">
          {required.map((v) => (
            <li key={v.key}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                onClick={() => onSelectView(v)}
                data-testid={`guided-capture-review-${v.key}`}
              >
                <span className="font-medium text-slate-900">
                  <span aria-hidden="true">{v.complete ? "✓ " : "○ "}</span>
                  {v.label}
                  <span className="sr-only">
                    {v.complete ? " complete" : " incomplete"}
                  </span>
                </span>
                <span className="text-sm text-slate-500">
                  {v.complete ? "Replace" : "Add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {recommended.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recommended
          </h3>
          <p className="mt-1 text-sm text-slate-600">{dto.recommendedNote}</p>
          <ul className="mt-2 space-y-2">
            {recommended.map((v) => (
              <li key={v.key}>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  onClick={() => onSelectView(v)}
                >
                  <span className="font-medium text-slate-900">
                    <span aria-hidden="true">{v.complete ? "✓ " : "○ "}</span>
                    {v.label}
                  </span>
                  <span className="text-sm text-slate-500">
                    {v.complete ? "Replace" : "Optional"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canFinish}
        className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50"
        data-testid="guided-capture-finish"
        onClick={onFinish}
      >
        Finish HairAudit photos
      </button>
      {!canFinish ? (
        <p className="text-sm text-slate-600">
          Add all required photos before finishing. Recommended photos are optional.
        </p>
      ) : null}
    </section>
  );
}
