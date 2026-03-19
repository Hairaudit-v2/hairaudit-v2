import Link from "next/link";

const links = [
  { href: "/professionals", label: "Overview" },
  { href: "/professionals/apply", label: "Create Profile" },
  { href: "/professionals/methodology", label: "Methodology" },
  { href: "/professionals/scoring-framework", label: "Scoring Framework" },
  { href: "/professionals/evidence-standards", label: "Evidence Standards" },
  { href: "/professionals/clinical-participation", label: "Clinical Participation" },
  { href: "/professionals/legal-documentation", label: "Legal Documentation" },
  { href: "/professionals/auditor-standards", label: "Auditor Standards" },
];

export default function ProfessionalsShell({
  currentPath,
  title,
  intro,
  children,
}: {
  currentPath: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid lg:grid-cols-[250px_1fr] gap-8 lg:gap-10">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold px-2 pb-2">
            Professional section
          </p>
          <nav className="space-y-1">
            {links.map((item) => {
              const active = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{title}</h1>
        <p className="mt-4 text-slate-400 max-w-3xl">{intro}</p>
        <div className="mt-8">{children}</div>
        <p className="mt-10 text-sm text-slate-500">
          Looking for the patient overview?{" "}
          <Link href="/how-it-works" className="text-amber-400 hover:text-amber-300 transition-colors">
            Return to How It Works
          </Link>
          {" · "}
          <Link href="/signup" className="text-cyan-300 hover:text-cyan-200 transition-colors">
            Create Clinic or Doctor Profile
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
