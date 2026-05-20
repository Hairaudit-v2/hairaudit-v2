import Link from "next/link";
import type { CompetencyReviewLinkRow } from "@/lib/academy/competencyReviewTraceability";

export default function CompetencyTraceabilityPanel({
  traineeId,
  links,
}: {
  traineeId: string;
  links: CompetencyReviewLinkRow[];
}) {
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Competency traceability</h2>
        <p className="mt-1 text-xs text-slate-600">
          Linked as supporting evidence. This review may support faculty competency decisions. Competency sign-off remains a
          separate faculty decision.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-slate-500">No competency observations or sign-offs are linked to this review yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {links.map((link) => (
            <li key={`${link.kind}-${link.id}`} className="rounded-lg border border-violet-100 bg-white px-3 py-2">
              <div className="font-medium text-slate-800">
                {link.kind === "achievement" ? "Sign-off" : "Observation"} · {link.ladderTitle} — {link.stepLabel}
              </div>
              <div className="text-xs text-slate-500">
                {link.kind === "achievement" && link.achievedAt
                  ? `Signed ${new Date(link.achievedAt).toLocaleDateString()}`
                  : link.createdAt
                    ? `Logged ${new Date(link.createdAt).toLocaleDateString()}`
                    : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/academy/trainees/${traineeId}/competency`}
        className="inline-block text-xs font-semibold text-violet-900 hover:underline"
      >
        Open competency dashboard →
      </Link>
    </section>
  );
}
