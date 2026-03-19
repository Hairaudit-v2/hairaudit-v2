import Link from "next/link";

export type ParticipationApprovalStatus =
  | "not_started"
  | "pending_review"
  | "approved"
  | "more_info_required";

type ParticipationStatusBannerProps = {
  status: ParticipationApprovalStatus;
  /** "doctor" | "clinic" for wording */
  role: "doctor" | "clinic";
};

const STATUS_CONFIG: Record<
  ParticipationApprovalStatus,
  { label: string; description: string; className: string }
> = {
  not_started: {
    label: "Profile not yet listed",
    description:
      "You can use the dashboard to create and submit cases. To be listed in the professional directory and leaderboards, complete your profile.",
    className: "border-slate-200 bg-slate-50 text-slate-800",
  },
  pending_review: {
    label: "Listing in progress",
    description:
      "Your profile details have been received and are being processed. You will be notified once your listing is updated.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  approved: {
    label: "Listed for participation",
    description:
      "Your profile is listed. Your submitted cases can contribute to benchmarking and public recognition where applicable.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  more_info_required: {
    label: "More information needed",
    description:
      "We need a bit more information to complete your profile listing. Please check your email or contact support.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

export default function ParticipationStatusBanner({ status, role }: ParticipationStatusBannerProps) {
  const config = STATUS_CONFIG[status];
  const profileHref = "/signup";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${config.className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{config.label}</p>
          <p className="mt-0.5 text-sm opacity-90">{config.description}</p>
        </div>
        {status === "not_started" && (
          <Link
            href={profileHref}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Complete profile
          </Link>
        )}
      </div>
    </div>
  );
}
