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

const MAX_BEFORE = 3;
const MAX_AFTER = 3;

export default function RateMyHairTransplantClient() {
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [monthsSinceProcedure, setMonthsSinceProcedure] = useState<string>("");
  const [concernLevel, setConcernLevel] = useState<"low" | "medium" | "high">("low");
  const [allowCommunityShare, setAllowCommunityShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<CommunityCase | null>(null);
  /** Avoid SSR/client mismatch: navigator only exists in the browser after mount. */
  const [canNativeShare, setCanNativeShare] = useState(false);

  const beforePreviews = useMemo(() => beforeFiles.map((f) => URL.createObjectURL(f)), [beforeFiles]);
  const afterPreviews = useMemo(() => afterFiles.map((f) => URL.createObjectURL(f)), [afterFiles]);

  useEffect(() => {
    return () => {
      beforePreviews.forEach((url) => URL.revokeObjectURL(url));
      afterPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [beforePreviews, afterPreviews]);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function submitCase() {
    setSubmitting(true);
    setError("");
    try {
      if (!beforeFiles.length || !afterFiles.length) {
        setError(
          "Choose at least one before surgery photo and one after surgery / current photo—both are required for a before-and-after comparison."
        );
        setSubmitting(false);
        return;
      }

      const orderedFiles = [...beforeFiles, ...afterFiles];
      const imageDataUrls = await Promise.all(orderedFiles.map((file) => readFileAsDataUrl(file)));
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
    if (!result || typeof navigator === "undefined" || typeof navigator.share !== "function") return;
    const shareUrl = `${window.location.origin}/case/${result.id}`;
    try {
      await navigator.share({
        title: "HairAudit: my outcome summary",
        text: `HairAudit rapid before-and-after outcome summary: ${result.overall_score}/100`,
        url: shareUrl,
      });
    } catch {
      /* user dismissed share sheet or target cancelled */
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 min-w-0">
      <h2 className="text-2xl font-semibold text-white text-balance">Upload: before, after, and timing</h2>
      <p className="mt-3 text-slate-300 leading-relaxed text-pretty break-words">
        This step compares how you looked <span className="text-slate-200">before surgery</span> with how
        you look <span className="text-slate-200">after surgery or today</span>. Please add{" "}
        <span className="text-slate-200">at least one before surgery photo</span>,{" "}
        <span className="text-slate-200">at least one after surgery / current photo</span>, and{" "}
        <span className="text-slate-200">approximately how long it has been since your procedure</span>{" "}
        (recommended—see note below).
      </p>

      <div className="mt-6 grid gap-6">
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <label htmlFor="rmht-before-input" className="text-sm font-medium text-slate-100 cursor-pointer">
              Before surgery photos
            </label>
            <span className="text-xs font-normal text-amber-200/90">Required</span>
          </div>
          <p id="rmht-before-help" className="mt-1 font-normal text-slate-400 text-xs leading-relaxed">
            Photos taken <strong className="font-medium text-slate-300">before</strong> your transplant:
            hairline, top, sides, or donor area—whatever shows your starting point. Similar angles to your
            after surgery / current photos make the comparison easiest to read.
          </p>
          <input
            id="rmht-before-input"
            type="file"
            accept="image/*"
            multiple
            aria-describedby="rmht-before-help rmht-before-status"
            aria-required
            className="mt-2 block w-full min-w-0 max-w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100 file:max-w-[min(100%,12rem)] file:truncate"
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []).slice(0, MAX_BEFORE);
              setBeforeFiles(chosen);
            }}
          />
          <p id="rmht-before-status" className="mt-2 text-xs text-slate-500 leading-relaxed" aria-live="polite">
            {beforeFiles.length === 0
              ? "No files added yet. Use the file picker above to add at least one before surgery photo."
              : `${beforeFiles.length} before surgery ${beforeFiles.length === 1 ? "photo" : "photos"} selected (up to ${MAX_BEFORE}).`}
          </p>
          {beforeFiles.length > 0 ? (
            <ul
              className="mt-2 space-y-0.5 border-t border-white/5 pt-2 text-xs text-slate-500"
              aria-label="Selected before surgery file names"
            >
              {beforeFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="min-w-0 truncate" title={f.name}>
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <label htmlFor="rmht-after-input" className="text-sm font-medium text-slate-100 cursor-pointer">
              After surgery / current photos
            </label>
            <span className="text-xs font-normal text-amber-200/90">Required</span>
          </div>
          <p id="rmht-after-help" className="mt-1 font-normal text-slate-400 text-xs leading-relaxed">
            Recent photos with the <strong className="font-medium text-slate-300">same kinds of views</strong>{" "}
            as your before surgery photos—how your hairline, density, and donor area look{" "}
            <strong className="font-medium text-slate-300">now</strong>. These are compared directly to your
            before surgery photos.
          </p>
          <input
            id="rmht-after-input"
            type="file"
            accept="image/*"
            multiple
            aria-describedby="rmht-after-help rmht-after-status"
            aria-required
            className="mt-2 block w-full min-w-0 max-w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100 file:max-w-[min(100%,12rem)] file:truncate"
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []).slice(0, MAX_AFTER);
              setAfterFiles(chosen);
            }}
          />
          <p id="rmht-after-status" className="mt-2 text-xs text-slate-500 leading-relaxed" aria-live="polite">
            {afterFiles.length === 0
              ? "No files added yet. Add at least one after surgery / current photo so we can compare to your before surgery photos."
              : `${afterFiles.length} after surgery / current ${afterFiles.length === 1 ? "photo" : "photos"} selected (up to ${MAX_AFTER}).`}
          </p>
          {afterFiles.length > 0 ? (
            <ul
              className="mt-2 space-y-0.5 border-t border-white/5 pt-2 text-xs text-slate-500"
              aria-label="Selected after surgery / current file names"
            >
              {afterFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="min-w-0 truncate" title={f.name}>
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 space-y-3">
          <p
            id="rmht-timing-note"
            className="text-xs text-slate-300 leading-relaxed border-l-2 border-amber-400/50 pl-3 text-pretty break-words"
          >
            <span className="font-medium text-slate-200">Why timing matters:</span> transplant results change
            month by month. Approximate time since surgery helps place your after surgery / current photos in
            the right context—so expectations stay fair and the read stays sensible.
          </p>
          <div>
            <label htmlFor="rmht-months-input" className="text-sm font-medium text-slate-100 block cursor-pointer">
              Approximate time since surgery
            </label>
            <p id="rmht-months-help" className="mt-1 text-xs text-slate-400 leading-relaxed">
              Optional but recommended. Enter whole months since your procedure; a rough estimate is fine.
            </p>
            <input
              id="rmht-months-input"
              type="number"
              min={0}
              max={240}
              placeholder="Number of months (e.g. 9)"
              value={monthsSinceProcedure}
              onChange={(e) => setMonthsSinceProcedure(e.target.value)}
              aria-describedby={
                monthsSinceProcedure
                  ? "rmht-timing-note rmht-months-help"
                  : "rmht-timing-note rmht-months-help rmht-months-status"
              }
              className="mt-2 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-600"
            />
            {monthsSinceProcedure === "" ? (
              <p id="rmht-months-status" className="mt-2 text-xs text-slate-500">
                No value added yet—optional; adding months improves context for your summary.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="rmht-concern-select" className="text-sm font-medium text-slate-100 cursor-pointer">
            How you&apos;re feeling about the result
          </label>
          <p id="rmht-concern-help" className="mt-1 text-xs text-slate-400 leading-relaxed">
            Optional. Helps calibrate tone for your summary; not a medical assessment.
          </p>
          <select
            id="rmht-concern-select"
            aria-describedby="rmht-concern-help"
            value={concernLevel}
            onChange={(e) => setConcernLevel(e.target.value as "low" | "medium" | "high")}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          >
            <option value="low">Low concern</option>
            <option value="medium">Medium concern</option>
            <option value="high">High concern</option>
          </select>
        </div>

        <label htmlFor="rmht-gallery-share" className="inline-flex items-start gap-3 text-sm text-slate-200 cursor-pointer">
          <input
            id="rmht-gallery-share"
            type="checkbox"
            checked={allowCommunityShare}
            onChange={(e) => setAllowCommunityShare(e.target.checked)}
            className="mt-1 shrink-0"
          />
          <span className="text-pretty break-words">
            Allow this summary to appear anonymously in the HairAudit community gallery.
          </span>
        </label>
      </div>

      {(beforePreviews.length > 0 || afterPreviews.length > 0) && (
        <div className="mt-6 space-y-5">
          {beforePreviews.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Before surgery photos (preview)
              </p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {beforePreviews.map((src, i) => (
                  <img
                    key={`b-${src}-${i}`}
                    src={src}
                    alt={`Selected before surgery photo preview ${i + 1} of ${beforePreviews.length}`}
                    width={224}
                    height={112}
                    className="h-28 w-full rounded-xl object-cover border border-white/10"
                  />
                ))}
              </div>
            </div>
          ) : null}
          {afterPreviews.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                After surgery / current photos (preview)
              </p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {afterPreviews.map((src, i) => (
                  <img
                    key={`a-${src}-${i}`}
                    src={src}
                    alt={`Selected after surgery or current photo preview ${i + 1} of ${afterPreviews.length}`}
                    width={224}
                    height={112}
                    className="h-28 w-full rounded-xl object-cover border border-white/10"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-6 min-w-0">
        <button
          type="button"
          disabled={submitting}
          onClick={submitCase}
          className="inline-flex w-full sm:w-auto max-w-full items-center justify-center px-4 sm:px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 text-center text-sm sm:text-base leading-snug sm:leading-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/50"
        >
          {submitting ? (
            <>
              <span className="sm:hidden">Generating…</span>
              <span className="hidden sm:inline">Generating your outcome summary…</span>
            </>
          ) : (
            <>
              <span className="sm:hidden">Get outcome summary</span>
              <span className="hidden sm:inline">Get rapid before-and-after outcome summary</span>
            </>
          )}
        </button>
        <p className="mt-3 max-w-xl text-xs text-slate-400 leading-relaxed text-pretty break-words">
          Both required photo sections above need at least one file. When you continue, we build your summary
          in a few moments—no extra upload steps.
        </p>
        <p className="mt-2 max-w-xl text-xs text-slate-500 leading-relaxed text-pretty break-words">
          For step-by-step intake, deeper review, and a shareable score suited to formal use, use{" "}
          <Link
            href="/request-review"
            className="text-amber-200/90 hover:text-amber-100 underline-offset-2 hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Request a formal HairAudit quality review
          </Link>
          .
        </p>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-300 text-pretty break-words" role="alert">
          {error}
        </p>
      ) : null}

      {result && (
        <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
          <h3 className="text-xl font-semibold text-emerald-100 text-balance">
            Your rapid before-and-after outcome summary
          </h3>
          <p className="mt-3 text-emerald-50/90 text-pretty break-words">{result.summary}</p>
          <p className="mt-3 text-xs text-emerald-50/75 leading-relaxed text-pretty break-words">
            Built for speed—not the full structured HairAudit quality pathway. When you want complete intake, a
            thorough review, and a shareable score for serious conversations, use{" "}
            <Link
              href="/request-review"
              className="text-emerald-200 underline-offset-2 hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Request a formal HairAudit quality review
            </Link>
            .
          </p>

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
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/60"
            >
              Download Share Card
            </button>
            {canNativeShare ? (
              <button
                type="button"
                onClick={shareCard}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-50 font-medium hover:bg-emerald-200/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Share
              </button>
            ) : null}
            <Link
              href={`/case/${result.id}`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-50 font-medium hover:bg-emerald-200/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              View Public Case Page
            </Link>
            {result.is_published ? (
              <Link
                href="/community-results"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-50 font-medium hover:bg-emerald-200/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Open Community Results
              </Link>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-emerald-50/80 text-pretty break-words">
            Share safely: crop or hide identifying details before posting screenshots or before-and-after
            photos.
          </p>
        </div>
      )}
    </section>
  );
}
