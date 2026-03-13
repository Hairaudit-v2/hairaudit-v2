"use client";

import { useState } from "react";

type LinkCheckResult = {
  id: string;
  label: string;
  redirectTo: string;
  ok: boolean;
  detail: string;
};

export default function AdminAuthHealthTester() {
  const [email, setEmail] = useState("");
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<LinkCheckResult[]>([]);

  async function runTest() {
    setRunning(true);
    setError("");
    setNote("");
    setResults([]);

    try {
      const res = await fetch("/api/admin/auth-health/test-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to run link generation test.");
      setResults(Array.isArray(json?.results) ? (json.results as LinkCheckResult[]) : []);
      setNote(String(json?.note ?? ""));
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to run link generation test.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">
        Supabase Redirect Acceptance Test
      </h2>
      <p className="mt-1 text-xs text-slate-300">
        Uses admin link generation to check whether Supabase accepts key redirect targets.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-300">
          Test email (optional)
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="defaults to your admin email"
            className="mt-1 w-72 rounded-md border border-white/20 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <button
          type="button"
          onClick={runTest}
          disabled={running}
          className="rounded-md border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
        >
          {running ? "Running..." : "Run test email check"}
        </button>
      </div>

      {note ? <p className="mt-3 text-xs text-emerald-200">{note}</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}

      {results.length > 0 ? (
        <div className="mt-3 space-y-2">
          {results.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-3 ${r.ok ? "border-emerald-300/30 bg-emerald-500/10" : "border-rose-300/30 bg-rose-500/10"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-100">{r.label}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.ok ? "bg-emerald-300/20 text-emerald-100" : "bg-rose-300/20 text-rose-100"
                  }`}
                >
                  {r.ok ? "Accepted" : "Rejected"}
                </span>
              </div>
              <p className="mt-1 break-all text-[11px] text-slate-300">{r.redirectTo}</p>
              <p className="mt-1 text-[11px] text-slate-200">{r.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
