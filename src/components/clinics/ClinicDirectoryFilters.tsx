"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silver" },
  { value: "VERIFIED", label: "Verified" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "high_transparency", label: "High transparency" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "not_started", label: "Not started" },
];

const SORT_OPTIONS = [
  { value: "certification", label: "Certification level" },
  { value: "public_cases", label: "Most public cases" },
  { value: "name", label: "Alphabetical" },
];

export default function ClinicDirectoryFilters({
  countries,
  foundingSlugs = [],
}: {
  countries: string[];
  foundingSlugs?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("search") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const country = searchParams.get("country") ?? "";
  const status = searchParams.get("status") ?? "";
  const benchmarkOnly = searchParams.get("benchmark") === "1";
  const sort = searchParams.get("sort") ?? "certification";
  const hasPublicCasesOnly = searchParams.get("has_public_cases") === "1";
  const foundingOnly = searchParams.get("founding") === "1";

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val == null || val === "") next.delete(key);
        else next.set(key, val);
      }
      startTransition(() => {
        router.push(`/clinics?${next.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("search") as HTMLInputElement)?.value?.trim() ?? "";
    updateParams({ search: q || null });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 sm:p-5">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search by clinic name"
            className="flex-1 min-w-[180px] rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
          <button
            type="submit"
            className="rounded-xl bg-cyan-500/20 border border-cyan-500/30 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 transition-colors"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={tier}
            onChange={(e) => updateParams({ tier: e.target.value || null })}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            aria-label="Filter by award tier"
          >
            {TIER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => updateParams({ country: e.target.value || null })}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value || null })}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            aria-label="Filter by transparency status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value || "certification" })}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={benchmarkOnly}
              onChange={(e) => updateParams({ benchmark: e.target.checked ? "1" : null })}
              className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="text-sm text-slate-300">Benchmark-active only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPublicCasesOnly}
              onChange={(e) => updateParams({ has_public_cases: e.target.checked ? "1" : null })}
              className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="text-sm text-slate-300">Has public cases</span>
          </label>
          {foundingSlugs.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={foundingOnly}
                onChange={(e) => updateParams({ founding: e.target.checked ? "1" : null })}
                className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-slate-300">Founding Clinic</span>
            </label>
          )}
        </div>
      </form>
      {isPending && (
        <p className="mt-2 text-xs text-slate-500">Updating…</p>
      )}
    </div>
  );
}
