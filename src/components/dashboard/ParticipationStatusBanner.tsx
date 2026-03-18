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
    label: "Application not started",
    description:
      "You can use the dashboard to create and submit cases. To be listed in the professional directory and leaderboards, apply for participation.",
    className: "border-slate-200 bg-slate-50 text-slate-800",
  },
  pending_review: {
    label: "Pending review",
    description:
      "Your participation application has been received and is under review. You will be notified once it has been processed.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  approved: {
    label: "Approved for participation",
    description:
      "Your participation is approved. Your submitted cases can contribute to benchmarking and public recognition where applicable.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  more_info_required: {
    label: "More information required",
    description:
      "We need a bit more information to complete your participation application. Please check your email or contact support.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

export default function ParticipationStatusBanner({ status, role }: ParticipationStatusBannerProps) {
  const config = STATUS_CONFIG[status];
  const applyHref = "/professionals/apply";

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
            href={applyHref}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply to participate
          </Link>
        )}
      </div>
    </div>
  );
}
