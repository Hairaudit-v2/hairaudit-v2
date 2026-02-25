"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong loading this case</h1>
        <p className="mt-2 text-sm text-slate-600">
          Please try again. If this keeps happening, check the server logs for the error digest below.
        </p>
        {error?.digest && (
          <p className="mt-4 text-xs text-slate-500">
            Digest: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-amber-500 text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-amber-400"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

