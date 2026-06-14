import { cn } from "@/lib/utils";

const TRUST_POINTS = [
  {
    title: "Independent review",
    body: "HairAudit is separate from your clinic. We do not sell surgery or paid clinic placements.",
  },
  {
    title: "Privacy protected",
    body: "Your photos and details stay private. Nothing is published without your clear permission.",
  },
  {
    title: "Not clinic marketing",
    body: "This is an evidence report, not a sales page. Findings follow what your photos support.",
  },
  {
    title: "Human-reviewed, evidence-aware",
    body: "Structured scoring is checked by reviewers when needed. Low photo quality means we say “not sure” — not a fake score.",
  },
  {
    title: "Secure upload",
    body: "Patient uploads use the same secure HairAudit flow. Use a private network you trust when you send photos.",
  },
  {
    title: "Not for emergencies",
    body: "HairAudit is not urgent medical care. If you have severe pain, fever, spreading redness, or other emergency signs, seek local urgent care.",
  },
] as const;

type PatientTrustPointsBlockProps = {
  className?: string;
  id?: string;
};

export default function PatientTrustPointsBlock({
  className,
  id = "patient-trust-points",
}: PatientTrustPointsBlockProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6", className)}
    >
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-emerald-100">
        Why patients trust this process
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {TRUST_POINTS.map(({ title, body }) => (
          <li key={title} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
