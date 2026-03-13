"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";
import { toCommunityScore100 } from "@/lib/communityCases";

type CommunityCase = {
  id: string;
  created_at: string;
  summary: string;
  image_data_urls: string[];
  overall_score: number;
  community_rating_count: number;
  community_naturalness_avg: number | null;
  community_density_avg: number | null;
  community_hairline_avg: number | null;
};

export default function CommunityResultsClient() {
  const [cases, setCases] = useState<CommunityCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/community-cases", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          if (!cancelled) setError(data?.error ?? "Could not load community results.");
          return;
        }
        if (!cancelled) setCases(Array.isArray(data.cases) ? data.cases : []);
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
  }, []);

  if (loading) return <p className="mt-6 text-slate-300">Loading community results...</p>;
  if (error) return <p className="mt-6 text-rose-300">{error}</p>;
  if (!cases.length) return <p className="mt-6 text-slate-300">No public community cases yet.</p>;

  return (
    <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cases.map((item) => {
        const communityScore = toCommunityScore100({
          naturalnessAvg: item.community_naturalness_avg,
          densityAvg: item.community_density_avg,
          hairlineAvg: item.community_hairline_avg,
        });
        const thumb = Array.isArray(item.image_data_urls) ? item.image_data_urls[0] : null;

        return (
          <Link
            key={item.id}
            href={`/case/${item.id}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/60 transition-colors"
          >
            {thumb ? (
              <img
                src={thumb}
                alt="Community case preview"
                className="h-36 w-full rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="h-36 w-full rounded-xl border border-white/10 bg-slate-900/60" />
            )}
            <HairAuditScoreVisual score={item.overall_score} className="mt-4 bg-slate-950/60" />
            <p className="mt-3 text-sm text-slate-300">{item.summary}</p>
            <p className="mt-3 text-xs text-slate-400">
              HairAudit Score: {item.overall_score} | Community Score:{" "}
              {communityScore == null ? "Not rated yet" : `${communityScore}/100`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Community ratings: {item.community_rating_count ?? 0}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
