import Link from "next/link";

type DoctorPreview = {
  id: string;
  name: string;
  title: string;
  yearsExperience: number | null;
  specialties: string[];
  profileImage: string | null;
  summary: string | null;
};

type CapabilityGroup = {
  label: string;
  items: string[];
};

type MissingItem = {
  label: string;
  href: string;
};

type Metric = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

export default function ClinicPublicPreview({
  clinicName,
  tagline,
  location,
  proceduresOffered,
  capabilityGroups,
  doctors,
  readinessStates,
  trustMetrics,
  missingItems,
  publicProfileLive,
}: {
  clinicName: string;
  tagline: string;
  location: string;
  proceduresOffered: string[];
  capabilityGroups: CapabilityGroup[];
  doctors: DoctorPreview[];
  readinessStates: Array<{ label: string; ready: boolean }>;
  trustMetrics: Metric[];
  missingItems: MissingItem[];
  publicProfileLive: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Public Clinic Preview</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">{clinicName}</h2>
        <p className="mt-1 text-sm text-slate-200">{tagline}</p>
        <p className="mt-1 text-xs text-slate-300">{location}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              publicProfileLive
                ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                : "border-amber-300/40 bg-amber-400/20 text-amber-100"
            }`}
          >
            {publicProfileLive ? "Public Listing Active" : "Public Listing In Progress"}
          </span>
          {readinessStates.map((state) => (
            <span
              key={state.label}
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                state.ready
                  ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                  : "border-slate-500/60 bg-slate-500/20 text-slate-200"
              }`}
            >
              {state.label}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trust and transparency indicators</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {trustMetrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    metric.tone === "success"
                      ? "text-emerald-700"
                      : metric.tone === "warning"
                        ? "text-amber-700"
                        : "text-slate-900"
                  }`}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-emerald-50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-800">Public profile impact teaser</h3>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            A complete public-facing clinic profile improves trust perception, case attribution, and discoverability quality.
          </p>
          <p className="mt-2 text-xs text-slate-700">
            This preview simulates how your clinic can appear once profile depth, doctor presentation, and evidence governance are fully complete.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/clinic/profile"
              className="rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-50"
            >
              Complete profile
            </Link>
            <Link
              href="/dashboard/clinic/doctors"
              className="rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-50"
            >
              Refine doctors
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Procedures offered</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {proceduresOffered.length > 0 ? (
            proceduresOffered.map((item) => (
              <span key={item} className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                {item}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-600">
              No procedure highlights yet. Add surgical methods to strengthen public clinical clarity.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {capabilityGroups.map((group) => (
          <div key={group.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
            {group.items.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {group.items.slice(0, 6).map((item) => (
                  <li key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Not yet documented. Adding this section improves trust depth and public profile completeness.
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Doctor preview cards</h3>
        {doctors.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No active doctors are visible yet. Add doctor profiles to increase public confidence and improve outcome attribution.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {doctors.map((doctor) => (
              <article key={doctor.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  {doctor.profileImage ? (
                    <img
                      src={doctor.profileImage}
                      alt={doctor.name}
                      className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700">
                      {doctor.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{doctor.name}</p>
                    <p className="text-xs text-slate-500">
                      {doctor.title} · {doctor.yearsExperience != null ? `${doctor.yearsExperience} yrs` : "Experience pending"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">{doctor.summary ?? "Doctor summary not yet configured."}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {doctor.specialties.slice(0, 4).map((spec) => (
                    <span key={`${doctor.id}-${spec}`} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {spec}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Example outcomes preview</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case story</p>
            <p className="mt-2 text-sm text-slate-700">Before/after narrative placeholder with method, timeframe, and documentation quality markers.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outcome confidence</p>
            <p className="mt-2 text-sm text-slate-700">Future public indicators for consistency, evidence completeness, and procedural rigor.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Care protocol</p>
            <p className="mt-2 text-sm text-slate-700">Placeholder for peri-operative protocol highlights that reinforce patient trust and quality governance.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Missing for stronger public presentation</h3>
        {missingItems.length === 0 ? (
          <p className="mt-2 text-sm text-amber-900">
            Excellent baseline. Your profile is ready for a strong public presentation once publishing is enabled.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {missingItems.map((item) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
