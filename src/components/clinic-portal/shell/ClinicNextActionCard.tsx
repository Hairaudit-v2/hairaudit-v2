import Link from "next/link";

export default function ClinicNextActionCard({
  title,
  description,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 via-slate-900/30 to-emerald-500/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Next Best Action</p>
      <p className="mt-2 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-200/90">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center rounded-lg border border-cyan-300/50 bg-cyan-300/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/30"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
