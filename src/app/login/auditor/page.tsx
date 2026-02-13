"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";

const AUDITOR_EMAIL = "manager@evolvedhair.com.au";

export default function AuditorLoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== AUDITOR_EMAIL) {
      setMsg(`Only ${AUDITOR_EMAIL} can sign in here. Use the regular login for other accounts.`);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
      return;
    }

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "auditor" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.warn("Profile update failed:", j);
        // Continue anyway - email check is primary
      }
    } catch {
      // Non-blocking
    }

    window.location.href = "/dashboard/auditor";
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <a
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-amber-400 mb-4 transition-colors"
          >
            ← Back to HairAudit
          </a>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex justify-center rounded-xl bg-slate-900 px-4 py-3">
              <Image
                src="/hair-audit-logo-white.png"
                alt="Hair Audit"
                width={220}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Auditor sign in</h1>
            <p className="mt-2 text-sm text-slate-600">
              Restricted to authorized auditors only. Use <strong>manager@evolvedhair.com.au</strong>.
            </p>

            <form onSubmit={signIn} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  placeholder={AUDITOR_EMAIL}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-semibold hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Sign in as auditor
              </button>
            </form>

            {msg && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              Not an auditor?{" "}
              <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">
                Standard sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
