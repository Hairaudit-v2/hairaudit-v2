"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/roles";
import SiteHeader from "@/components/SiteHeader";

export default function SignUpPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("patient");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
      setBusy(false);
      return;
    }

    await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });

    router.push("/dashboard");
    router.refresh();
    setBusy(false);
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
                src="/hair-audit-logo-white.svg"
                alt="Hair Audit"
                width={160}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
            <p className="mt-2 text-sm text-slate-600">
              Choose your role: <strong>Patient</strong> (get feedback on your surgery), <strong>Doctor</strong> (submit cases and review audits), or <strong>Clinic</strong> (submit cases and compare outcomes).
            </p>

            <form onSubmit={signUp} className="mt-6 space-y-4">
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
                  minLength={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  I am a
                </label>
                <div className="flex flex-wrap gap-2">
                  {USER_ROLES.map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        role === r
                          ? "border-amber-500 bg-amber-50 text-amber-900"
                          : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-amber-500 text-slate-900 py-2.5 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {busy ? "Creating…" : "Sign up"}
              </button>
            </form>

            {msg && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
