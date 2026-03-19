"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ProfilePrefill = {
  id: string;
  doctor_name: string;
  doctor_email?: string;
  years_experience?: number;
  clinic_name?: string;
} | null;

export default function DoctorOnboardingForm() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/doctor-onboarding");
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const profile = json?.profile as ProfilePrefill;
        if (profile) {
          setDoctorName(profile.doctor_name ?? "");
          setDoctorEmail(profile.doctor_email ?? "");
          setYearsExperience(
            profile.years_experience != null ? String(profile.years_experience) : ""
          );
          setClinicName(profile.clinic_name ?? "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = doctorName.trim();
    if (!name) {
      setError("Doctor name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/doctor-onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctor_name: name,
          doctor_email: doctorEmail.trim() || undefined,
          years_experience:
            yearsExperience.trim() !== ""
              ? parseInt(yearsExperience.trim(), 10)
              : undefined,
          clinic_name: clinicName.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json?.error as string) ?? "Failed to save profile.");
        return;
      }
      router.replace("/dashboard/doctor");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Professional profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          A minimal profile helps attribute your cases and build your public record.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="doctor_name" className="block text-sm font-medium text-slate-700">
              Full name <span className="text-amber-600">*</span>
            </label>
            <input
              id="doctor_name"
              type="text"
              required
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g. Dr. Jane Smith"
            />
          </div>
          <div>
            <label htmlFor="doctor_email" className="block text-sm font-medium text-slate-700">
              Email (optional)
            </label>
            <input
              id="doctor_email"
              type="email"
              value={doctorEmail}
              onChange={(e) => setDoctorEmail(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="Professional email"
            />
          </div>
          <div>
            <label htmlFor="clinic_name" className="block text-sm font-medium text-slate-700">
              Clinic or practice name (optional)
            </label>
            <input
              id="clinic_name"
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g. City Hair Clinic"
            />
          </div>
          <div>
            <label htmlFor="years_experience" className="block text-sm font-medium text-slate-700">
              Years of experience (optional)
            </label>
            <input
              id="years_experience"
              type="number"
              min={0}
              max={100}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="mt-1 block w-full max-w-[8rem] rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="0"
            />
          </div>
        </div>
        {error ? (
          <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || !doctorName.trim()}
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Continue to dashboard"}
          </button>
          <Link
            href="/dashboard/doctor"
            className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to overview
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm text-slate-600">
          After saving, you can create your first audit case from the doctor overview and start
          building your evidence-based record.
        </p>
        <Link
          href="/dashboard/doctor"
          className="mt-2 inline-block text-sm font-medium text-cyan-700 hover:text-cyan-800"
        >
          Go to overview and create a case →
        </Link>
      </div>
    </form>
  );
}
