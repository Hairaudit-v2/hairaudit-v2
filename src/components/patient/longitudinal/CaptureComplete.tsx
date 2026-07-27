"use client";

import Link from "next/link";
import type { GuidedLongitudinalCaptureDto } from "@/lib/outcomeIntelligence/guidedCaptureDto";

export default function CaptureComplete({
  dto,
  backHref,
}: {
  dto: GuidedLongitudinalCaptureDto;
  backHref: string;
}) {
  const reviewHref =
    dto.status === "observed" && dto.nextAction.href
      ? dto.nextAction.href
      : backHref;

  return (
    <section className="space-y-5" data-testid="guided-capture-complete">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {dto.status === "observed"
            ? dto.statusMessage
            : "Your follow-up photos are complete."}
        </h2>
        {dto.status === "ready_for_review" || dto.status === "evidence_incomplete" ? (
          <p className="mt-2 text-sm text-slate-700">
            HairAudit now has the required views for your{" "}
            {dto.title.replace(/^Your\s+/i, "")} review.
          </p>
        ) : null}
        {dto.status === "observed" && !dto.nextAction.href ? (
          <p className="mt-2 text-sm text-slate-700">{dto.statusMessage}</p>
        ) : null}
      </div>

      {dto.status === "observed" && dto.nextAction.type === "view_review" ? (
        <Link
          href={reviewHref}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          data-testid="guided-capture-view-review"
        >
          View review
        </Link>
      ) : (
        <Link
          href={backHref}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          data-testid="guided-capture-return"
        >
          Return to HairAudit
        </Link>
      )}
    </section>
  );
}
