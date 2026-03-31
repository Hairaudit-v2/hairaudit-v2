import Link from "next/link";
import type { ReactNode } from "react";
import { isPatientGuideRequestReviewHref } from "@/lib/analytics/patientGuideMeasurement";

const LINK_IN_TEXT = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Renders markdown-style inline links `[label](/path)` as Next.js links. */
export function PatientEducationLinkedText({ text, guideSlug }: { text: string; guideSlug: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_IN_TEXT.source, "g");
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const href = match[2];
    const bodyRequestReview =
      guideSlug && isPatientGuideRequestReviewHref(href)
        ? {
            "data-cta": "patient-guide-body-request-review" as const,
            "data-patient-guide": guideSlug,
            "data-cta-destination": "/request-review" as const,
          }
        : null;
    parts.push(
      <Link
        key={key++}
        href={href}
        className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-medium"
        {...(bodyRequestReview ?? {})}
      >
        {match[1]}
      </Link>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}
