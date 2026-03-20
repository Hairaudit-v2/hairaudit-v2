"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslateFn } from "@/lib/i18n/getTranslation";
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

/** Maps stored select values (English) to translation keys for display only. */
const ADVANCED_SELECT_LABEL_KEYS: Record<string, Record<string, string>> = {
  surgical_team_size: {
    "2-4": "dashboard.clinic.forms.profileBuilder.optSurgicalTeam2to4",
    "5-8": "dashboard.clinic.forms.profileBuilder.optSurgicalTeam5to8",
    "9-12": "dashboard.clinic.forms.profileBuilder.optSurgicalTeam9to12",
    "12+": "dashboard.clinic.forms.profileBuilder.optSurgicalTeam12plus",
  },
  avg_cases_per_month: {
    "<20": "dashboard.clinic.forms.profileBuilder.optCasesLt20",
    "20-50": "dashboard.clinic.forms.profileBuilder.optCases20to50",
    "51-100": "dashboard.clinic.forms.profileBuilder.optCases51to100",
    "100+": "dashboard.clinic.forms.profileBuilder.optCases100plus",
  },
  qa_protocol: {
    "Daily checklist": "dashboard.clinic.forms.profileBuilder.optQaDaily",
    "Weekly QA huddle": "dashboard.clinic.forms.profileBuilder.optQaWeekly",
    "Case-level QA signoff": "dashboard.clinic.forms.profileBuilder.optQaCaseSignoff",
    "Multilayer QA board": "dashboard.clinic.forms.profileBuilder.optQaMultilayer",
  },
  training_program: {
    "Internal mentorship": "dashboard.clinic.forms.profileBuilder.optTrainingMentorship",
    "Weekly cadaver lab": "dashboard.clinic.forms.profileBuilder.optTrainingCadaver",
    "Quarterly competency review": "dashboard.clinic.forms.profileBuilder.optTrainingQuarterly",
    "Hybrid external training": "dashboard.clinic.forms.profileBuilder.optTrainingHybrid",
  },
  internal_audit_frequency: {
    "Per case": "dashboard.clinic.forms.profileBuilder.optAuditPerCase",
    Weekly: "dashboard.clinic.forms.profileBuilder.optAuditWeekly",
    "Bi-weekly": "dashboard.clinic.forms.profileBuilder.optAuditBiweekly",
    Monthly: "dashboard.clinic.forms.profileBuilder.optAuditMonthly",
  },
  patient_followup_protocol: {
    "Day 1 / Week 1 / Month 1 / Month 6 / Month 12": "dashboard.clinic.forms.profileBuilder.optFollowupDay1",
    "Week 1 / Month 1 / Month 3 / Month 6 / Month 12": "dashboard.clinic.forms.profileBuilder.optFollowupWeek1",
    "Custom protocol": "dashboard.clinic.forms.profileBuilder.optFollowupCustom",
  },
};

function displayAdvancedSelectLabel(t: TranslateFn, fieldKey: string, stored: string): string {
  const path = ADVANCED_SELECT_LABEL_KEYS[fieldKey]?.[stored];
  if (!path) return stored;
  const out = t(path);
  return out === path ? stored : out;
}

const advancedSelectOptions: Record<string, string[]> = {
  surgical_team_size: ["2-4", "5-8", "9-12", "12+"],
  avg_cases_per_month: ["<20", "20-50", "51-100", "100+"],
  qa_protocol: ["Daily checklist", "Weekly QA huddle", "Case-level QA signoff", "Multilayer QA board"],
  training_program: ["Internal mentorship", "Weekly cadaver lab", "Quarterly competency review", "Hybrid external training"],
  internal_audit_frequency: ["Per case", "Weekly", "Bi-weekly", "Monthly"],
  patient_followup_protocol: [
    "Day 1 / Week 1 / Month 1 / Month 6 / Month 12",
    "Week 1 / Month 1 / Month 3 / Month 6 / Month 12",
    "Custom protocol",
  ],
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

const BASIC_FIELD_KEYS = [
  "tagline",
  "primary_country",
  "primary_city",
  "year_established",
  "lead_doctor",
  "contact_email",
  "website",
] as const;

const ADVANCED_FIELD_DEFS = [
  { key: "surgical_team_size", labelKey: "dashboard.clinic.forms.profileBuilder.fieldSurgicalTeamSize" as const },
  { key: "avg_cases_per_month", labelKey: "dashboard.clinic.forms.profileBuilder.fieldAvgCasesPerMonth" as const },
  { key: "qa_protocol", labelKey: "dashboard.clinic.forms.profileBuilder.fieldQaProtocol" as const },
  { key: "training_program", labelKey: "dashboard.clinic.forms.profileBuilder.fieldTrainingProgram" as const },
  { key: "internal_audit_frequency", labelKey: "dashboard.clinic.forms.profileBuilder.fieldInternalAuditFrequency" as const },
  { key: "primary_machine_stack", labelKey: "dashboard.clinic.forms.profileBuilder.fieldPrimaryMachineStack" as const },
  { key: "sterilization_protocol", labelKey: "dashboard.clinic.forms.profileBuilder.fieldSterilizationProtocol" as const },
  { key: "patient_followup_protocol", labelKey: "dashboard.clinic.forms.profileBuilder.fieldPatientFollowupProtocol" as const },
];

export default function ClinicProfileBuilder({
  initialBasicProfile,
  initialAdvancedProfile,
  initialBasicCompletion,
  initialAdvancedCompletion,
  initialCapabilities,
}: Props) {
  const { t } = useI18n();
  const [basicProfile, setBasicProfile] = useState<Record<string, unknown>>(initialBasicProfile ?? {});
  const [advancedProfile, setAdvancedProfile] = useState<Record<string, unknown>>(initialAdvancedProfile ?? {});
  const [basicCompletion, setBasicCompletion] = useState(initialBasicCompletion ?? 0);
  const [advancedCompletion, setAdvancedCompletion] = useState(initialAdvancedCompletion ?? 0);
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>(initialCapabilities ?? []);
  const [capabilityType, setCapabilityType] = useState("method");
  const [capabilityName, setCapabilityName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const basicFieldLabels = useMemo(
    () => ({
      tagline: t("dashboard.clinic.forms.profileBuilder.fieldTagline"),
      primary_country: t("dashboard.clinic.forms.profileBuilder.fieldPrimaryCountry"),
      primary_city: t("dashboard.clinic.forms.profileBuilder.fieldPrimaryCity"),
      year_established: t("dashboard.clinic.forms.profileBuilder.fieldYearEstablished"),
      lead_doctor: t("dashboard.clinic.forms.profileBuilder.fieldLeadDoctor"),
      contact_email: t("dashboard.clinic.forms.profileBuilder.fieldContactEmail"),
      website: t("dashboard.clinic.forms.profileBuilder.fieldWebsite"),
    }),
    [t]
  );

  const advancedFields = useMemo(
    () =>
      ADVANCED_FIELD_DEFS.map((def) => ({
        key: def.key,
        label: t(def.labelKey),
      })),
    [t]
  );

  const capabilityTypeOptions = useMemo(
    () => [
      { value: "method", label: t("dashboard.clinic.forms.profileBuilder.capTypeMethod") },
      { value: "tool", label: t("dashboard.clinic.forms.profileBuilder.capTypeTool") },
      { value: "device", label: t("dashboard.clinic.forms.profileBuilder.capTypeDevice") },
      { value: "machine", label: t("dashboard.clinic.forms.profileBuilder.capTypeMachine") },
      { value: "optional_extra", label: t("dashboard.clinic.forms.profileBuilder.capTypeOptionalExtra") },
      { value: "protocol", label: t("dashboard.clinic.forms.profileBuilder.capTypeProtocol") },
    ],
    [t]
  );

  const groupedCapabilities = useMemo(() => {
    return capabilityTypeOptions.map((type) => ({
      ...type,
      items: capabilities.filter((c) => c.capability_type === type.value),
    }));
  }, [capabilities, capabilityTypeOptions]);

  const readinessStates = useMemo(
    () => [
      { label: t("dashboard.clinic.forms.profileBuilder.readinessBasic"), ready: basicCompletion >= 90 },
      { label: t("dashboard.clinic.forms.profileBuilder.readinessEnhanced"), ready: advancedCompletion >= 70 },
      { label: t("dashboard.clinic.forms.profileBuilder.readinessBenchmark"), ready: advancedCompletion >= 80 && capabilities.length >= 6 },
      { label: t("dashboard.clinic.forms.profileBuilder.readinessPublic"), ready: basicCompletion >= 80 },
      { label: t("dashboard.clinic.forms.profileBuilder.readinessTraining"), ready: advancedCompletion >= 80 },
    ],
    [t, basicCompletion, advancedCompletion, capabilities.length]
  );

  const nextActions = useMemo(
    () => [
      basicCompletion < 90
        ? { label: t("dashboard.clinic.forms.profileBuilder.nextCompleteIdentity"), href: "/dashboard/clinic/profile" }
        : { label: t("dashboard.clinic.forms.profileBuilder.nextPublicProfile"), href: "/dashboard/clinic/profile" },
      capabilities.length < 6
        ? { label: t("dashboard.clinic.forms.profileBuilder.nextAddMethods"), href: "/dashboard/clinic/profile#clinical-stack" }
        : { label: t("dashboard.clinic.forms.profileBuilder.nextUploadDevices"), href: "/dashboard/clinic/profile#clinical-stack" },
      { label: t("dashboard.clinic.forms.profileBuilder.nextWorkspaces"), href: "/dashboard/clinic/workspaces" },
    ],
    [t, basicCompletion, capabilities.length]
  );

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
      if (!res.ok) throw new Error(json?.error ?? t("dashboard.clinic.forms.profileBuilder.errorSaveProfile"));
      setBasicCompletion(Number(json?.completion?.basic ?? 0));
      setAdvancedCompletion(Number(json?.completion?.advanced ?? 0));
      setMessage(t("dashboard.clinic.forms.profileBuilder.messageSaved"));
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? t("dashboard.clinic.forms.profileBuilder.errorSaveProfile"));
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
      if (!res.ok) throw new Error(json?.error ?? t("dashboard.clinic.forms.profileBuilder.errorAddCapability"));
      if (json?.item) setCapabilities((prev) => [...prev, json.item as CapabilityItem]);
      setCapabilityName("");
      setMessage(t("dashboard.clinic.forms.profileBuilder.messageCapabilityAdded"));
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? t("dashboard.clinic.forms.profileBuilder.errorAddCapability"));
    } finally {
      setSaving(false);
    }
  }

  function applyProfileDefaults() {
    setBasicProfile((prev) => ({ ...profileDefaults.basic, ...prev }));
    setAdvancedProfile((prev) => ({ ...profileDefaults.advanced, ...prev }));
    setMessage(t("dashboard.clinic.forms.profileBuilder.messageDefaultsApplied"));
  }

  async function deleteCapability(id: string) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/clinic-portal/capabilities?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? t("dashboard.clinic.forms.profileBuilder.errorRemoveCapability"));
      setCapabilities((prev) => prev.filter((item) => item.id !== id));
      setMessage(t("dashboard.clinic.forms.profileBuilder.messageCapabilityRemoved"));
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? t("dashboard.clinic.forms.profileBuilder.errorRemoveCapability"));
    } finally {
      setSaving(false);
    }
  }

  const machineLabel = t("dashboard.clinic.forms.profileBuilder.fieldPrimaryMachineStack");
  const sterilizationLabel = t("dashboard.clinic.forms.profileBuilder.fieldSterilizationProtocol");

  return (
    <div className="space-y-6">
      <ClinicConversionPanel
        title={t("dashboard.clinic.forms.profileBuilder.trustTitle")}
        subtitle={t("dashboard.clinic.forms.profileBuilder.trustSubtitle")}
        nextActions={nextActions}
        readinessStates={readinessStates}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("dashboard.clinic.forms.profileBuilder.basicSectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("dashboard.clinic.forms.profileBuilder.basicSectionLead")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyProfileDefaults}
            className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
          >
            {t("dashboard.clinic.forms.profileBuilder.applyDefaults")}
          </button>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {t("dashboard.clinic.forms.profileBuilder.saveOnceHint")}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{t("dashboard.clinic.forms.profileBuilder.completion")}</span>
          <span>{basicCompletion}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${basicCompletion}%` }} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BASIC_FIELD_KEYS.map((key) => (
            <label key={key} className="block text-sm text-slate-700">
              {basicFieldLabels[key]}
              <input
                value={String(basicProfile[key] ?? "")}
                onChange={(event) => setBasicProfile((prev) => ({ ...prev, [key]: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("dashboard.clinic.forms.profileBuilder.advancedSectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("dashboard.clinic.forms.profileBuilder.advancedSectionLead")}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{t("dashboard.clinic.forms.profileBuilder.completion")}</span>
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
                      onChange={(event) => setAdvancedProfile((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">{t("dashboard.clinic.forms.profileBuilder.selectPrompt")}</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {displayAdvancedSelectLabel(t, field.key, opt)}
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
                    onChange={(event) => setAdvancedProfile((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              );
            })}
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            {t("dashboard.clinic.forms.profileBuilder.advancedMetadataSummary")}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              {machineLabel}
              <input
                value={String(advancedProfile.primary_machine_stack ?? "")}
                onChange={(event) =>
                  setAdvancedProfile((prev) => ({ ...prev, primary_machine_stack: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t("dashboard.clinic.forms.profileBuilder.fieldMachinePlaceholder")}
              />
            </label>
            <label className="block text-sm text-slate-700">
              {sterilizationLabel}
              <input
                value={String(advancedProfile.sterilization_protocol ?? "")}
                onChange={(event) =>
                  setAdvancedProfile((prev) => ({ ...prev, sterilization_protocol: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t("dashboard.clinic.forms.profileBuilder.fieldSterilizationPlaceholder")}
              />
            </label>
          </div>
        </details>
      </section>

      <section id="clinical-stack" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("dashboard.clinic.forms.profileBuilder.clinicalStackTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("dashboard.clinic.forms.profileBuilder.clinicalStackLead")}</p>
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
            placeholder={t("dashboard.clinic.forms.profileBuilder.capabilityPlaceholder")}
          />
          <button
            type="button"
            onClick={addCapability}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {t("forms.shared.add")}
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {groupedCapabilities.map((group) => (
            <div key={group.value} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
              {group.items.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{t("dashboard.clinic.forms.profileBuilder.emptyGroupHint")}</p>
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
                        {t("forms.shared.remove")}
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
        <p className="text-sm text-slate-600">{saving ? t("forms.shared.saving") : message}</p>
        <button
          type="button"
          onClick={() => saveProfiles(basicProfile, advancedProfile)}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {t("dashboard.clinic.forms.profileBuilder.footerSave")}
        </button>
      </div>
    </div>
  );
}
