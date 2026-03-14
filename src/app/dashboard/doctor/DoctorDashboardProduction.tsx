"use client";

import Link from "next/link";
import CreateCaseButton from "../create-case-button";

type CaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
};

export default function DoctorDashboardProduction({
  cases,
}: {
  cases: CaseRow[];
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Doctor workspace</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete the surgery form and upload photos per case. Each case uses the same audit flow: form → photos → submit.
        </p>
        <div className="mt-4">
          <CreateCaseButton variant="premium" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Your cases</h2>
        {!cases || cases.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center">
            <p className="text-slate-700 font-medium">No cases yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Create a case to start the doctor audit flow (form + photos).
            </p>
            <div className="mt-4">
              <CreateCaseButton />
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-slate-900">
                    {c.title ?? "Untitled case"}
                  </span>
                  <span className="ml-2 text-slate-500 text-sm capitalize">
                    — {c.status ?? "draft"}
                  </span>
                  <div className="text-xs text-slate-400 mt-2">
                    Created: {new Date(c.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
