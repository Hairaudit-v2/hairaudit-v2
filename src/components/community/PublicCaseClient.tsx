"use client";

import { useEffect, useMemo, useState } from "react";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";
import { toCommunityScore100 } from "@/lib/communityCases";

type PublicCase = {
  id: string;
  summary: string;
  image_data_urls: string[];
  hairline_design_score: number;
  density_score: number;
  donor_preservation_score: number;
  naturalness_score: number;
  overall_score: number;
  community_rating_count: number;
  community_naturalness_avg: number | null;
  community_density_avg: number | null;
  community_hairline_avg: number | null;
};

export default function PublicCaseClient({ caseId }: { caseId: string }) {
  const [item, setItem] = useState<PublicCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [naturalness, setNaturalness] = useState(4);
  const [density, setDensity] = useState(4);
  const [hairlineDesign, setHairlineDesign] = useState(4);
  const [ratingMsg, setRatingMsg] = useState("");

  const communityScore = useMemo(() => {
    if (!item) return null;
    return toCommunityScore100({
      naturalnessAvg: item.community_naturalness_avg,
      densityAvg: item.community_density_avg,
      hairlineAvg: item.community_hairline_avg,
    });
  }, [item]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/community-cases/detail?caseId=${encodeURIComponent(caseId)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          if (!cancelled) setError(data?.error ?? "Could not load case.");
          return;
        }
        if (!cancelled) setItem(data.case as PublicCase);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function submitRating() {
    setRatingMsg("");
    const res = await fetch("/api/community-cases/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        naturalness,
        density,
        hairlineDesign,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setRatingMsg(data?.error ?? "Could not submit rating.");
      return;
    }
    const ag = data.aggregates ?? {};
    setItem((prev) =>
      prev
        ? {
            ...prev,
            community_rating_count: Number(ag.count ?? prev.community_rating_count),
            community_naturalness_avg:
              typeof ag.naturalnessAvg === "number" ? ag.naturalnessAvg : prev.community_naturalness_avg,
            community_density_avg:
              typeof ag.densityAvg === "number" ? ag.densityAvg : prev.community_density_avg,
            community_hairline_avg:
              typeof ag.hairlineAvg === "number" ? ag.hairlineAvg : prev.community_hairline_avg,
          }
        : prev
    );
    setRatingMsg("Thank you for rating this case.");
  }

  if (loading) return <p className="mt-6 text-slate-300">Loading case...</p>;
  if (error) return <p className="mt-6 text-rose-300">{error}</p>;
  if (!item) return <p className="mt-6 text-slate-300">Case not found.</p>;

  return (
    <div className="mt-8">
      <div className="grid lg:grid-cols-[1fr_0.95fr] gap-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">Case images</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(item.image_data_urls ?? []).map((src, idx) => (
              <img
                key={`${item.id}-${idx}`}
                src={src}
                alt={`Case image ${idx + 1}`}
                width={352}
                height={176}
                className="h-44 w-full rounded-xl object-cover border border-white/10"
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold text-white">Scores</h2>
          <HairAuditScoreVisual score={item.overall_score} className="mt-4 bg-slate-950/60" />

          <div className="mt-5 space-y-2 text-sm text-slate-300">
            <p>- Hairline Design: {item.hairline_design_score}</p>
            <p>- Density: {item.density_score}</p>
            <p>- Donor Preservation: {item.donor_preservation_score}</p>
            <p>- Naturalness: {item.naturalness_score}</p>
            <p className="font-semibold text-slate-100">- HairAudit Score: {item.overall_score}</p>
            <p className="font-semibold text-slate-100">
              - Community Score: {communityScore == null ? "Not rated yet" : `${communityScore}/100`}
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-300">{item.summary}</p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
        <h2 className="text-xl font-semibold text-cyan-100">Rate this case</h2>
        <p className="mt-2 text-sm text-cyan-50/90">
          Optional community rating system. Score each area from 1 (low) to 5 (high).
        </p>

        <div className="mt-4 grid sm:grid-cols-3 gap-4 text-sm text-cyan-50/95">
          <label>
            Naturalness
            <input
              type="number"
              min={1}
              max={5}
              value={naturalness}
              onChange={(e) => setNaturalness(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label>
            Density
            <input
              type="number"
              min={1}
              max={5}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label>
            Hairline design
            <input
              type="number"
              min={1}
              max={5}
              value={hairlineDesign}
              onChange={(e) => setHairlineDesign(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-cyan-100/30 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={submitRating}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-cyan-200 text-slate-900 font-medium hover:bg-cyan-100 transition-colors"
          >
            Submit Rating
          </button>
          <p className="text-sm text-cyan-50/90">
            Community ratings: {item.community_rating_count ?? 0}
          </p>
        </div>
        {ratingMsg ? <p className="mt-3 text-sm text-cyan-50/90">{ratingMsg}</p> : null}
      </section>
    </div>
  );
}
