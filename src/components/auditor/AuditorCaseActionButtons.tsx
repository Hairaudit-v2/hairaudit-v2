"use client";

import {
  type AuditorCaseAction,
  type AuditorCaseActionKind,
} from "@/lib/auditor/auditorCaseActions";

function classForKind(kind: AuditorCaseActionKind, primary: boolean, size: "sm" | "md"): string {
  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";
  const weight = primary || size === "md" ? "font-semibold" : "font-medium";
  if (primary) {
    return `rounded-lg bg-slate-900 ${pad} ${weight} text-white hover:bg-slate-800 disabled:opacity-60`;
  }
  if (kind === "delete_case") {
    return `rounded-lg border border-rose-400 ${pad} ${weight} text-rose-800 hover:bg-rose-50 disabled:opacity-60`;
  }
  if (kind === "archive_case") {
    return `rounded-lg border border-slate-400 ${pad} ${weight} text-slate-700 hover:bg-slate-100 disabled:opacity-60`;
  }
  if (kind === "retry_processing" || kind === "retry_pdf") {
    return `rounded-lg border border-red-300 ${pad} ${weight} text-red-800 hover:bg-red-50 disabled:opacity-60`;
  }
  if (kind === "request_missing_images") {
    return `rounded-lg border border-orange-300 ${pad} ${weight} text-orange-800 hover:bg-orange-50 disabled:opacity-60`;
  }
  if (kind === "image_limited_override") {
    return `rounded-lg border border-violet-400 ${pad} ${weight} text-violet-900 hover:bg-violet-50 disabled:opacity-60`;
  }
  return `rounded-lg border border-slate-300 ${pad} ${weight} text-slate-800 hover:bg-slate-50 disabled:opacity-60`;
}

export type AuditorCaseActionButtonsProps = {
  actions: AuditorCaseAction[];
  busy?: boolean;
  size?: "sm" | "md";
  onAction: (action: AuditorCaseAction) => void;
};

export default function AuditorCaseActionButtons({
  actions,
  busy = false,
  size = "sm",
  onAction,
}: AuditorCaseActionButtonsProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={`${action.kind}-${action.label}`}
          type="button"
          disabled={busy}
          data-action={action.kind}
          onClick={() => onAction(action)}
          className={classForKind(action.kind, action.primary, size)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
