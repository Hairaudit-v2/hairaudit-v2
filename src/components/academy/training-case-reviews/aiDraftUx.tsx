"use client";

import type { AiReviewConfidence } from "@/lib/academy/trainingCaseReviews/aiDraftTypes";
import { CONFIDENCE_CAUTION_COPY } from "@/lib/academy/trainingCaseReviews/aiInsertHelpers";

export function ConfidenceBadge({ confidence }: { confidence?: AiReviewConfidence | null }) {
  if (!confidence) return null;
  const styles =
    confidence === "high"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : confidence === "medium"
        ? "bg-sky-50 text-sky-800 border-sky-200"
        : "bg-amber-50 text-amber-900 border-amber-200";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles}`}>
        AI confidence: {confidence}
      </span>
      {confidence === "low" ? (
        <span className="text-xs text-amber-800">{CONFIDENCE_CAUTION_COPY}</span>
      ) : null}
    </div>
  );
}

export function MissingPhotoWarning({ categories }: { categories: string[] }) {
  if (!categories.length) return null;
  return (
    <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
      <p className="font-semibold">Incomplete photo documentation</p>
      <p className="mt-1">
        Some expected training photos were not available, so the AI draft may be incomplete.
      </p>
      <ul className="mt-2 list-disc pl-4">
        {categories.map((c) => (
          <li key={c}>{c.replace(/_/g, " ")}</li>
        ))}
      </ul>
    </div>
  );
}

export function DraftStateBanner({
  state,
  errorMessage,
  imageCount,
}: {
  state: "not_configured" | "no_images" | "failed" | "placeholder";
  errorMessage?: string | null;
  imageCount?: number;
}) {
  const copy: Record<typeof state, { title: string; steps: string[] }> = {
    not_configured: {
      title: "AI review is not enabled in this environment",
      steps: [
        "Configure OPENAI_API_KEY (and ensure ENABLE_TRAINING_CASE_AI_REVIEW is not set to false).",
        "Enter coaching feedback manually in the sections below.",
        "Save draft and submit when ready — trainees only see submitted reviews.",
      ],
    },
    placeholder: {
      title: "AI draft placeholder only",
      steps: [
        "The AI provider is not available; no image analysis was performed.",
        "Use the review form below to write feedback manually.",
      ],
    },
    no_images: {
      title: "No active training images on this case",
      steps: [
        `Upload training case photos (${imageCount ?? 0} active images detected).`,
        "Regenerate the AI draft after photos are available, or write feedback manually.",
      ],
    },
    failed: {
      title: "AI draft generation did not complete",
      steps: [
        errorMessage ?? "The AI service returned an error or validation failed.",
        "Try generating again, or enter feedback manually below.",
        "Nothing is shared with the trainee until you submit the final review.",
      ],
    },
  };

  const { title, steps } = copy[state];
  const tone =
    state === "failed"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${tone}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc pl-4 space-y-1">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export function InsertLinkButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-xs font-medium text-violet-800 hover:underline disabled:opacity-40 disabled:no-underline"
    >
      {children}
    </button>
  );
}

export async function confirmReplaceIfNeeded(
  fieldLabel: string,
  hasExisting: boolean,
): Promise<"append" | "replace" | "cancel"> {
  if (!hasExisting) return "append";
  const replace = window.confirm(
    `${fieldLabel} already has text.\n\nOK = Replace existing text\nCancel = Keep existing and append below`,
  );
  return replace ? "replace" : "append";
}
