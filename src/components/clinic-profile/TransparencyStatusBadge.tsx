const STATUS_LABELS: Record<string, string> = {
  high_transparency: "High transparency",
  active: "Active participant",
  invited: "Invited",
  not_started: "Not started",
};

export default function TransparencyStatusBadge({
  participationStatus,
}: {
  participationStatus: string | null | undefined;
}) {
  const status = String(participationStatus ?? "not_started");
  const label = STATUS_LABELS[status] ?? "Participant";

  const isActive = status === "high_transparency" || status === "active";

  return (
    <span
      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
        isActive
          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
          : "bg-white/10 text-slate-400 border border-white/15"
      }`}
    >
      {label}
    </span>
  );
}
