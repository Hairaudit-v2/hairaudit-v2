"use client";

import { useMemo, useState } from "react";
import ClinicConversionPanel from "@/components/clinic-portal/ClinicConversionPanel";

type CapabilityItem = {
  id: string;
  capability_type: string;
  capability_name: string;
  capability_details: Record<string, unknown>;
};

type Props = {
  initialBasicProfile: Record<string, unknown>;
  initialAdvancedProfile: Record<string, unknown>;
  initialBasicCompletion: number;
  initialAdvancedCompletion: number;
  initialCapabilities: CapabilityItem[];
};

const capabilityTypeOptions = [
  { value: "method", label: "Surgical Method" },
  { value: "tool", label: "Tool" },
  { value: "device", label: "Device" },
  { value: "machine", label: "Machine" },
  { value: "optional_extra", label: "Optional Extra" },
  { value: "protocol", label: "Protocol" },
];

const basicFields = [
  { key: "tagline", label: "Clinic positioning tagline" },
  { key: "primary_country", label: "Primary country" },
  { key: "primary_city", label: "Primary city" },
  { key: "year_established", label: "Year established" },
  { key: "lead_doctor", label: "Lead doctor" },
  { key: "contact_email", label: "Contact email" },
  { key: "website", label: "Website" },
];

const advancedFields = [
  { key: "surgical_team_size", label: "Surgical team size" },
  { key: "avg_cases_per_month", label: "Average cases per month" },
  { key: "qa_protocol", label: "QA protocol" },
  { key: "training_program", label: "Training program" },
  { key: "internal_audit_frequency", label: "Internal audit frequency" },
  { key: "primary_machine_stack", label: "Primary machine stack" },
  { key: "sterilization_protocol", label: "Sterilization protocol" },
  { key: "patient_followup_protocol", label: "Patient follow-up protocol" },
];

const advancedSelectOptions: Record<string, string[]> = {
  surgical_team_size: ["2-4", "5-8", "9-12", "12+"],
  avg_cases_per_month: ["<20", "20-50", "51-100", "100+"],
  qa_protocol: ["Daily checklist", "Weekly QA huddle", "Case-level QA signoff", "Multilayer QA board"],
  training_program: ["Internal mentorship", "Weekly cadaver lab", "Quarterly competency review", "Hybrid external training"],
  internal_audit_frequency: ["Per case", "Weekly", "Bi-weekly", "Monthly"],
  patient_followup_protocol: ["Day 1 / Week 1 / Month 1 / Month 6 / Month 12", "Week 1 / Month 1 / Month 3 / Month 6 / Month 12", "Custom protocol"],
};

const profileDefaults = {
  basic: {
    tagline: "Evidence-led hair restoration with structured quality controls",
    year_established: "2015",
    website: "https://",
  },
  advanced: {
    surgical_team_size: "5-8",
    avg_cases_per_month: "51-100",
    qa_protocol: "Case-level QA signoff",
    training_program: "Internal mentorship",
    internal_audit_frequency: "Weekly",
    patient_followup_protocol: "Day 1 / Week 1 / Month 1 / Month 6 / Month 12",
  },
};

export default function ClinicProfileBuilder({
  initialBasicProfile,
  initialAdvancedProfile,
  initialBasicCompletion,
  initialAdvancedCompletion,
  initialCapabilities,
}: Props) {
  const [basicProfile, setBasicProfile] = useState<Record<string, unknown>>(initialBasicProfile ?? {});
  const [advancedProfile, setAdvancedProfile] = useState<Record<string, unknown>>(initialAdvancedProfile ?? {});
  const [basicCompletion, setBasicCompletion] = useState(initialBasicCompletion ?? 0);
  const [advancedCompletion, setAdvancedCompletion] = useState(initialAdvancedCompletion ?? 0);
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>(initialCapabilities ?? []);
  const [capabilityType, setCapabilityType] = useState("method");
  const [capabilityName, setCapabilityName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const groupedCapabilities = useMemo(() => {
    return capabilityTypeOptions.map((type) => ({
      ...type,
      items: capabilities.filter((c) => c.capability_type === type.value),
    }));
  }, [capabilities]);
  const readinessStates = [
    { label: "Basic Profile Complete", ready: basicCompletion >= 90 },
    { label: "Enhanced Trust Profile", ready: advancedCompletion >= 70 },
    { label: "Benchmark Ready", ready: advancedCompletion >= 80 && capabilities.length >= 6 },
    { label: "Public Listing In Progress", ready: basicCompletion >= 80 },
    { label: "Training Ready", ready: advancedCompletion >= 80 },
  ];

  async function saveProfiles(nextBasic: Record<string, unknown>, nextAdvanced: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/clinic-portal/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          basicProfile: nextBasic,
          advancedProfile: nextAdvanced,
          completedSteps: ["foundation", "clinical_stack"],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to save profile.");
      setBasicCompletion(Number(json?.completion?.basic ?? 0));
      setAdvancedCompletion(Number(json?.completion?.advanced ?? 0));
      setMessage("Clinic profile saved.");
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function addCapability() {
    if (!capabilityName.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/clinic-portal/capabilities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          capabilityType,
          capabilityName: capabilityName.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to add capability.");
      if (json?.item) setCapabilities((prev) => [...prev, json.item as CapabilityItem]);
      setCapabilityName("");
      setMessage("Capability added.");
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to add capability.");
    } finally {
      setSaving(false);
    }
  }

  function applyProfileDefaults() {
    setBasicProfile((prev) => ({ ...profileDefaults.basic, ...prev }));
    setAdvancedProfile((prev) => ({ ...profileDefaults.advanced, ...prev }));
    setMessage("Applied repeat-friendly defaults. Review and save.");
  }

  async function deleteCapability(id: string) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/clinic-portal/capabilities?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to remove capability.");
      setCapabilities((prev) => prev.filter((item) => item.id !== id));
      setMessage("Capability removed.");
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to remove capability.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ClinicConversionPanel
        title="Profile trust conversion guidance"
        subtitle="A complete clinic identity plus deep procedural metadata improves attribution quality and reinforces medical credibility."
        nextActions={[
          basicCompletion < 90
            ? { label: "Complete your clinic identity", href: "/dashboard/clinic/profile" }
            : { label: "Prepare your public profile", href: "/dashboard/clinic/profile" },
          capabilities.length < 6
            ? { label: "Add your surgical methods", href: "/dashboard/clinic/profile#clinical-stack" }
            : { label: "Upload devices and technology", href: "/dashboard/clinic/profile#clinical-stack" },
          { label: "Respond to patient-submitted cases", href: "/dashboard/clinic/workspaces" },
        ]}
        readinessStates={readinessStates}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Basic clinic profile</h2>
        <p className="mt-1 text-sm text-slate-600">This powers your trust posture and profile discoverability.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyProfileDefaults}
            className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
          >
            Apply standard clinic defaults
          </button>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            Save once, then edit only what changed
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Completion</span>
          <span>{basicCompletion}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${basicCompletion}%` }} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {basicFields.map((field) => (
            <label key={field.key} className="block text-sm text-slate-700">
              {field.label}
              <input
                value={String(basicProfile[field.key] ?? "")}
                onChange={(event) =>
                  setBasicProfile((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Advanced operating profile</h2>
        <p className="mt-1 text-sm text-slate-600">Designed for QA, benchmarking, and training intelligence modules.</p>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Completion</span>
          <span>{advancedCompletion}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${advancedCompletion}%` }} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {advancedFields
            .filter((field) => !["primary_machine_stack", "sterilization_protocol"].includes(field.key))
            .map((field) => {
              const options = advancedSelectOptions[field.key];
              if (options) {
                return (
                  <label key={field.key} className="block text-sm text-slate-700">
                    {field.label}
                    <select
                      value={String(advancedProfile[field.key] ?? "")}
                      onChange={(event) =>
                        setAdvancedProfile((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select...</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field.key} className="block text-sm text-slate-700">
                  {field.label}
                  <input
                    value={String(advancedProfile[field.key] ?? "")}
                    onChange={(event) =>
                      setAdvancedProfile((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              );
            })}
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced metadata (optional)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Primary machine stack
              <input
                value={String(advancedProfile.primary_machine_stack ?? "")}
                onChange={(event) =>
                  setAdvancedProfile((prev) => ({ ...prev, primary_machine_stack: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="e.g. Choi + sapphire + cooling chain"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Sterilization protocol
              <input
                value={String(advancedProfile.sterilization_protocol ?? "")}
                onChange={(event) =>
                  setAdvancedProfile((prev) => ({ ...prev, sterilization_protocol: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="e.g. WHO checklist + dual verification"
              />
            </label>
          </div>
        </details>
      </section>

      <section id="clinical-stack" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Clinical stack catalog</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add methods, tools, devices, machine details, optional extras, and protocols.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
          <select
            value={capabilityType}
            onChange={(event) => setCapabilityType(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {capabilityTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={capabilityName}
            onChange={(event) => setCapabilityName(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Sapphire FUE punch, Choi implanter, cold-chain protocol"
          />
          <button
            type="button"
            onClick={addCapability}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Add
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {groupedCapabilities.map((group) => (
            <div key={group.value} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
              {group.items.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No entries yet. Add structured details here to strengthen profile trust and improve benchmark-readiness.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                      <span className="text-sm text-slate-800">{item.capability_name}</span>
                      <button
                        type="button"
                        onClick={() => deleteCapability(item.id)}
                        className="text-xs font-medium text-rose-700 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">{saving ? "Saving..." : message}</p>
        <button
          type="button"
          onClick={() => saveProfiles(basicProfile, advancedProfile)}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save profile
        </button>
      </div>
    </div>
  );
}
