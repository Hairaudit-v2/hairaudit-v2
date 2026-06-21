import { cn } from "@/lib/utils";
import type { ModuleStatus } from "@/content/platformProgress";

const statusStyles: Record<ModuleStatus, string> = {
  Live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  Production: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  "Pilot Ready": "border-amber-400/30 bg-amber-400/10 text-amber-100",
  "Active Development": "border-violet-400/30 bg-violet-400/10 text-violet-100",
  "Infrastructure Complete": "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
};

type ProgressStatusBadgeProps = {
  status: ModuleStatus;
  className?: string;
};

export default function ProgressStatusBadge({ status, className }: ProgressStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        statusStyles[status],
        className
      )}
    >
      {status}
    </span>
  );
}
