"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CaseItem = {
  caseId: string;
  title: string;
  patientReference: string;
  doctorName: string | null;
  procedureDate: string | null;
  submissionChannel: string;
  visibilityScope: string;
  auditStatus: string;
  evidenceStrength: string;
  confidenceLabel: string;
  actionNeeded: string;
  actionNeededKey: string;
  actionPriority: number;
  createdAt: string;
  submittedAt: string | null;
  archivedAt: string | null;
  publishEligible: boolean;
  clinicResponseStatus: string;
};

const TAB_DEFINITIONS = [
  { id: "all", label: "All" },
  { id: "patient_submitted", label: "Invited Contributions" },
  { id: "clinic_submitted", label: "Submitted Cases" },
  { id: "awaiting_input", label: "Awaiting Clinic Input" },
  { id: "in_progress", label: "In Progress" },
  { id: "internal", label: "Internal" },
  { id: "public_publish", label: "Public / Publish Eligible" },
  { id: "archived", label: "Archived" },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleDateString();
}

function humanizeChannel(channel: string) {
  if (channel === "patient_submitted") return "Invited contribution";
  if (channel === "clinic_submitted") return "Submitted case";
  if (channel === "doctor_submitted") return "Doctor-submitted";
  if (channel === "imported") return "Imported";
  return channel.replaceAll("_", " ");
}

function badgeClass(kind: "action" | "visibility" | "status" | "evidence", value: string) {
  if (kind === "action") {
    if (value === "awaiting_clinic_details" || value === "missing_evidence") return "bg-rose-50 text-rose-700 border-rose-200";
    if (value === "review_visibility" || value === "in_progress") return "bg-amber-50 text-amber-700 border-amber-200";
    if (value === "publish_eligible") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }
  if (kind === "visibility") {
    return value === "public"
      ? "bg-cyan-50 text-cyan-700 border-cyan-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  }
  if (kind === "status") {
    if (value === "complete") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (value === "submitted") return "bg-cyan-50 text-cyan-700 border-cyan-200";
    if (value === "draft") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }
  if (value === "A" || value === "B") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "C") return "bg-amber-50 text-amber-700 border-amber-200";
  if (value === "D" || value === "N/A") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function primaryAction(item: CaseItem) {
  if (item.actionNeededKey === "awaiting_clinic_details") {
    return { href: `/dashboard/clinic/workspaces?caseId=${item.caseId}`, label: "Respond to audit" };
  }
  if (item.actionNeededKey === "missing_evidence") {
    return { href: `/cases/${item.caseId}/clinic/photos`, label: "Upload evidence" };
  }
  if (item.actionNeededKey === "in_progress") {
    return { href: `/cases/${item.caseId}/clinic/form`, label: "Complete case details" };
  }
  if (item.actionNeededKey === "review_visibility") {
    return { href: `/dashboard/clinic/workspaces?caseId=${item.caseId}`, label: "Review visibility" };
  }
  if (item.actionNeededKey === "publish_eligible") {
    return { href: `/cases/${item.caseId}`, label: "Ready for review" };
  }
  return { href: `/cases/${item.caseId}`, label: "Open case" };
}

function includesTab(item: CaseItem, tab: string) {
  if (tab === "all") return true;
  if (tab === "patient_submitted") return item.submissionChannel === "patient_submitted";
  if (tab === "clinic_submitted") return item.submissionChannel === "clinic_submitted";
  if (tab === "awaiting_input") {
    return item.clinicResponseStatus === "pending_response" || item.actionNeededKey === "awaiting_clinic_details";
  }
  if (tab === "in_progress") return item.auditStatus === "draft" || item.auditStatus === "submitted" || item.actionNeededKey === "in_progress";
  if (tab === "internal") return item.visibilityScope === "internal" && !item.archivedAt;
  if (tab === "public_publish") return item.visibilityScope === "public" || item.publishEligible;
  if (tab === "archived") return Boolean(item.archivedAt);
  return true;
}

export default function ClinicCasesManager({ initialItems = [] }: { initialItems?: CaseItem[] }) {
  const [items, setItems] = useState<CaseItem[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TAB_DEFINITIONS)[number]["id"]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (initialItems.length > 0) return;
    (async () => {
      try {
        const res = await fetch("/api/clinic-portal/cases");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Unable to load clinic cases.");
        if (!cancelled) setItems(Array.isArray(json?.items) ? (json.items as CaseItem[]) : []);
      } catch (err: unknown) {
        if (!cancelled) setError((err as Error)?.message ?? "Unable to load clinic cases.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  const tabCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tab of TAB_DEFINITIONS) counts.set(tab.id, 0);
    for (const item of items) {
      for (const tab of TAB_DEFINITIONS) {
        if (includesTab(item, tab.id)) counts.set(tab.id, Number(counts.get(tab.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!includesTab(item, activeTab)) return false;
      if (!needle) return true;
      return [
        item.patientReference,
        item.title,
        item.doctorName ?? "",
        item.caseId,
        humanizeChannel(item.submissionChannel),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [activeTab, items, query]);

  const actionRequired = useMemo(
    () => items.filter((item) => !item.archivedAt && item.actionPriority >= 70).slice(0, 6),
    [items]
  );

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading clinic cases...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-rose-700">{error}</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action Required</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Priority clinic tasks</h2>
          </div>
          <Link
            href="/dashboard/clinic/submit-case"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Submit new case
          </Link>
        </div>

        {actionRequired.length === 0 ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            No urgent tasks right now. Your clinic case pipeline looks healthy.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actionRequired.map((item) => {
              const action = primaryAction(item);
              return (
                <article key={`priority-${item.caseId}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.patientReference}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass("action", item.actionNeededKey)}`}>
                      {item.actionNeeded}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.title}</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={action.href} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      {action.label}
                    </Link>
                    <Link href={`/cases/${item.caseId}`} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      Open
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {TAB_DEFINITIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  activeTab === tab.id
                    ? "border-cyan-400 bg-cyan-50 text-cyan-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label} ({tabCounts.get(tab.id) ?? 0})
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient ref, doctor, case id..."
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">No cases match this view yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Adjust filters or create a Submitted Case to start building trust assets.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredItems.map((item) => {
              const action = primaryAction(item);
              return (
                <article key={item.caseId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{item.patientReference}</p>
                      <p className="text-xs text-slate-500">
                        {item.title} · Case {item.caseId.slice(0, 8)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass("action", item.actionNeededKey)}`}>
                      {item.actionNeeded}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Doctor</p>
                      <p className="mt-1 text-sm text-slate-800">{item.doctorName ?? "Not assigned"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Procedure Date</p>
                      <p className="mt-1 text-sm text-slate-800">{formatDate(item.procedureDate)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Submission Channel</p>
                      <p className="mt-1 text-sm text-slate-800">{humanizeChannel(item.submissionChannel)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Evidence</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {item.evidenceStrength} · {item.confidenceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass("status", item.auditStatus)}`}>
                      {item.auditStatus.replaceAll("_", " ")}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass("visibility", item.visibilityScope)}`}>
                      {item.visibilityScope}
                    </span>
                    {item.publishEligible ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Publish Eligible
                      </span>
                    ) : null}
                    {item.archivedAt ? (
                      <span className="rounded-full border border-slate-300 bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                        Archived
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={action.href} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                      {action.label}
                    </Link>
                    <Link href={`/cases/${item.caseId}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                      Open case
                    </Link>
                    <Link href={`/dashboard/clinic/workspaces?caseId=${item.caseId}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                      Contribution settings
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
