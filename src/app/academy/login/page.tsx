"use client";

import { useEffect } from "react";
import Link from "next/link";
import { getCanonicalAppUrl } from "@/lib/auth/redirects";

export default function AcademyLoginPage() {
  const next = "/academy/dashboard";
  const appUrl = getCanonicalAppUrl();
  const loginUrl = `${appUrl}/login?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    window.location.replace(loginUrl);
  }, [loginUrl]);

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-slate-700">Redirecting to sign in…</p>
      <p className="mt-4 text-sm text-slate-500">
        If you are not redirected,{" "}
        <Link href={loginUrl} className="text-amber-700 font-medium underline">
          open the login page
        </Link>
        .
      </p>
    </main>
  );
}
