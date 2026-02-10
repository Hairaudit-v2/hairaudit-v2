export default function AuditScoreBadge({ score }: { score?: number }) {
  if (typeof score !== "number") {
    return (
      <span className="rounded-md bg-gray-200 px-2 py-1 text-xs text-gray-600">
        Pending
      </span>
    );
  }

  let color = "bg-gray-200 text-gray-800";
  let label = "Unrated";

  if (score >= 80) {
    color = "bg-green-100 text-green-800";
    label = "Excellent";
  } else if (score >= 60) {
    color = "bg-amber-100 text-amber-800";
    label = "Acceptable";
  } else {
    color = "bg-red-100 text-red-800";
    label = "Poor";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${color}`}
    >
      {score}/100 — {label}
    </span>
  );
}
