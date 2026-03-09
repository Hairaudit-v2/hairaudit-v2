export default function AuditFindingsPreview() {
  const findings = [
    "Donor pattern appears generally controlled, with mild extraction-density variance in the mid-occipital region.",
    "Recipient-zone implantation angle consistency is moderate with localized directional deviation near frontal transition points.",
    "Documentation quality is sufficient for core scoring, but limited intraoperative detail reduces certainty on graft handling conditions.",
  ];

  const recommendations = [
    "Add standardized 12-month follow-up photos (lighting and angle matched) to improve longitudinal confidence.",
    "Where corrective planning is considered, capture higher-resolution donor close-ups and recipient macro documentation.",
    "For benchmark or transparency context, include procedural metadata to strengthen defensibility and comparability.",
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-7">
      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Findings summary
        </p>
        <ul className="mt-3 space-y-3">
          {findings.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
              <span className="text-amber-400">-</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Recommendations
        </p>
        <ul className="mt-3 space-y-3">
          {recommendations.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
              <span className="text-amber-400">-</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
