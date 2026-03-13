"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HairAuditScoreVisual from "@/components/seo/HairAuditScoreVisual";

type CommunityCase = {
  id: string;
  summary: string;
  hairline_design_score: number;
  density_score: number;
  donor_preservation_score: number;
  naturalness_score: number;
  overall_score: number;
  is_published: boolean;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to decode ${file.name}`));
      img.src = String(reader.result ?? "");
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function readFileAsDataUrl(file: File) {
  const img = await loadImage(file);
  const maxWidth = 1280;
  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create image canvas.");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function buildShareCardBlob(params: {
  caseId: string;
  hairline: number;
  density: number;
  donor: number;
  naturalness: number;
  overall: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(251,191,36,0.2)");
  gradient.addColorStop(1, "rgba(16,185,129,0.2)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 58px sans-serif";
  ctx.fillText("HairAudit Score", 90, 150);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "400 36px sans-serif";
  ctx.fillText("Independent hair transplant quality summary", 90, 210);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "800 170px sans-serif";
  ctx.fillText(String(params.overall), 90, 400);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 48px sans-serif";
  ctx.fillText("/100", 330, 400);

  const rows: Array<[string, number]> = [
    ["Hairline Design", params.hairline],
    ["Density", params.density],
    ["Donor Preservation", params.donor],
    ["Naturalness", params.naturalness],
  ];

  let y = 520;
  for (const [label, value] of rows) {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "500 38px sans-serif";
    ctx.fillText(label, 90, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 38px sans-serif";
    ctx.fillText(String(value), 900, y);
    y += 95;
  }

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 30px sans-serif";
  ctx.fillText(`Public case: hairaudit.com/case/${params.caseId}`, 90, 1080);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Failed to generate image blob."));
      else resolve(blob);
    }, "image/png");
  });
}

export default function RateMyHairTransplantClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [monthsSinceProcedure, setMonthsSinceProcedure] = useState<string>("");
  const [concernLevel, setConcernLevel] = useState<"low" | "medium" | "high">("low");
  const [allowCommunityShare, setAllowCommunityShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<CommunityCase | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  async function submitCase() {
    setSubmitting(true);
    setError("");
    try {
      if (!files.length) {
        setError("Please upload at least one photo.");
        setSubmitting(false);
        return;
      }

      const imageDataUrls = await Promise.all(files.slice(0, 6).map((file) => readFileAsDataUrl(file)));
      const res = await fetch("/api/community-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrls,
          monthsSinceProcedure: monthsSinceProcedure ? Number(monthsSinceProcedure) : null,
          concernLevel,
          allowCommunityShare,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not calculate score.");
        setSubmitting(false);
        return;
      }
      setResult(data.case as CommunityCase);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadShareCard() {
    if (!result) return;
    const blob = await buildShareCardBlob({
      caseId: result.id,
      hairline: result.hairline_design_score,
      density: result.density_score,
      donor: result.donor_preservation_score,
      naturalness: result.naturalness_score,
      overall: result.overall_score,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hairaudit-score-${result.id}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareCard() {
    if (!result || !navigator.share) return;
    const shareUrl = `${window.location.origin}/case/${result.id}`;
    await navigator.share({
      title: "My HairAudit Score",
      text: `My HairAudit Score is ${result.overall_score}/100`,
      url: shareUrl,
    });
  }

  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-2xl font-semibold text-white">Upload photos and get your score</h2>
      <p className="mt-3 text-slate-300">
        Upload clear photos (up to 6 images). HairAudit generates a simplified score summary.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="text-sm text-slate-200">
          Photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100"
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []).slice(0, 6);
              setFiles(chosen);
            }}
          />
        </label>

        <label className="text-sm text-slate-200">
          Months since procedure (optional)
          <input
            type="number"
            min={0}
            max={240}
            value={monthsSinceProcedure}
            onChange={(e) => setMonthsSinceProcedure(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </label>

        <label className="text-sm text-slate-200">
          Current concern level
          <select
            value={concernLevel}
            onChange={(e) => setConcernLevel(e.target.value as "low" | "medium" | "high")}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          >
            <option value="low">Low concern</option>
            <option value="medium">Medium concern</option>
            <option value="high">High concern</option>
          </select>
        </label>

        <label className="inline-flex items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={allowCommunityShare}
            onChange={(e) => setAllowCommunityShare(e.target.checked)}
            className="mt-1"
          />
          <span>
            Allow my case to be shared anonymously in the HairAudit community gallery.
          </span>
        </label>
      </div>

      {previews.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {previews.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={src}
              alt={`Uploaded preview ${i + 1}`}
              className="h-28 w-full rounded-xl object-cover border border-white/10"
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          disabled={submitting}
          onClick={submitCase}
          className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60"
        >
          {submitting ? "Generating score..." : "Get Your Hair Transplant Score"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      {result && (
        <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
          <h3 className="text-xl font-semibold text-emerald-100">Your simplified score summary</h3>
          <p className="mt-3 text-emerald-50/90">{result.summary}</p>

          <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm text-emerald-50/95">
            <p>- Hairline Design: {result.hairline_design_score}</p>
            <p>- Density: {result.density_score}</p>
            <p>- Donor Preservation: {result.donor_preservation_score}</p>
            <p>- Naturalness: {result.naturalness_score}</p>
            <p className="font-semibold">- Overall Score: {result.overall_score}</p>
          </div>

          <HairAuditScoreVisual score={result.overall_score} className="mt-5 bg-slate-950/60" />

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={downloadShareCard}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors"
            >
              Download Share Card
            </button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <button
                type="button"
                onClick={shareCard}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-50 font-medium hover:bg-emerald-200/10 transition-colors"
              >
                Share
              </button>
            ) : null}
            <Link
              href={`/case/${result.id}`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-50 font-medium hover:bg-emerald-200/10 transition-colors"
            >
              View Public Case Page
            </Link>
            {result.is_published ? (
              <Link
                href="/community-results"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-50 font-medium hover:bg-emerald-200/10 transition-colors"
              >
                Open Community Results
              </Link>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-emerald-50/80">
            Share safely: remove identifying details before posting screenshots or images.
          </p>
        </div>
      )}
    </section>
  );
}
