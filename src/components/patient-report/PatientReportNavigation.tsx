"use client";

import { useEffect, useMemo, useState } from "react";

export type PatientReportNavItem = {
  id: string;
  label: string;
};

export default function PatientReportNavigation({
  items,
}: {
  items: PatientReportNavItem[];
}) {
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [items]);

  const [active, setActive] = useState(unique[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (unique.length === 0) return;
    const observers: IntersectionObserver[] = [];
    for (const item of unique) {
      const el = document.getElementById(`patient-report-${item.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) setActive(item.id);
          }
        },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [unique]);

  if (unique.length < 2) return null;

  const jump = (id: string) => {
    const el = document.getElementById(`patient-report-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
    setMenuOpen(false);
  };

  return (
    <nav
      data-testid="patient-report-navigation"
      aria-label="Report sections"
      className="patient-report-no-print"
    >
      {/* Desktop sticky */}
      <div className="sticky top-0 z-20 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block">
        <ul className="flex flex-wrap gap-1 px-4 py-2 lg:px-8">
          {unique.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => jump(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  active === item.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile compact menu */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span>Jump to section</span>
          <span aria-hidden>{menuOpen ? "▲" : "▼"}</span>
        </button>
        {menuOpen ? (
          <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2">
            {unique.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => jump(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </nav>
  );
}
