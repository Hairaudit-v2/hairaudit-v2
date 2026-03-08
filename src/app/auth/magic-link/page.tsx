"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function MagicLinkPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [msg, setMsg] = useState("Signing you in...");

  useEffect(() => {
    let mounted = true;

    async function completeMagicLink() {
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        window.location.replace("/dashboard");
        return;
      }

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          window.location.replace("/dashboard");
          return;
        }
      }

      if (mounted) {
        setMsg("This sign-in link is invalid or expired. Please request a new magic link.");
      }
    }

    completeMagicLink();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Completing sign-in</h1>
          <p className="mt-3 text-sm text-slate-600">{msg}</p>
          <div className="mt-6">
            <Link href="/login" className="text-sm font-medium text-amber-600 hover:text-amber-500">
              Back to login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
