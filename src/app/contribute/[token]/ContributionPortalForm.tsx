"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  PROCEDURE_TYPE_OPTIONS,
  BOOLEAN_YES_NO_OPTIONS,
  EXTRACTION_METHOD_OPTIONS,
  EXTRACTION_DEVICE_OPTIONS,
  PUNCH_SIZE_OPTIONS,
  DONOR_QUALITY_RATING_OPTIONS,
  HOLDING_SOLUTION_OPTIONS,
  OUT_OF_BODY_TIME_CATEGORY_OPTIONS,
  IMPLANTATION_METHOD_OPTIONS,
  IMPLANTED_BY_OPTIONS,
  SITE_CREATION_METHOD_OPTIONS,
  IMPLANTATION_DEVICE_OPTIONS,
  type AuditOption,
} from "@/lib/audit/masterSurgicalMetadata";

const YES_NO_UNKNOWN: AuditOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
];

const GRAFT_COUNT_RANGES: AuditOption[] = [
  { value: "0_1000", label: "Up to 1,000" },
  { value: "1001_2500", label: "1,001 – 2,500" },
  { value: "2501_4000", label: "2,501 – 4,000" },
  { value: "4001_plus", label: "4,001+" },
];

const DOCUMENTATION_LEVEL_OPTIONS: AuditOption[] = [
  { value: "minimal", label: "Minimal" },
  { value: "standard", label: "Standard" },
  { value: "comprehensive", label: "Comprehensive" },
];

const GRAFT_COUNT_VERIFICATION_OPTIONS: AuditOption[] = [
  { value: "verified_match", label: "Verified match" },
  { value: "minor_discrepancy", label: "Minor discrepancy noted" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "not_verified", label: "Not verified" },
  { value: "not_applicable", label: "N/A" },
];

const DISCREPANCY_DETECTION_OPTIONS: AuditOption[] = [
  { value: "none", label: "None" },
  { value: "minor", label: "Minor" },
  { value: "significant", label: "Significant" },
  { value: "not_assessed", label: "Not assessed" },
];

const CONFIDENCE_LEVEL_OPTIONS: AuditOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const CONTRIBUTION_DEFAULTS_KEY = "hairaudit_contribution_defaults";
const PARTICIPATION_LEARN_HREF = "/professionals/clinical-participation";
const CREATE_PROFILE_HREF = "/professionals/apply";

function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: AuditOption[];
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RadioGroup({
  label,
  value,
  onChange,
  options,
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: AuditOption[];
  name: string;
}) {
  return (
    <fieldset className="block">
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={o.value} className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <span className="text-sm text-slate-700">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder = "e.g. 3500",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block text-sm text-slate-700">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
      />
    </label>
  );
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function PostSubmissionPanel({
  submittedSnapshot,
  defaultsSaved,
  onSaveDefaults,
  onContinueWithoutSaving,
}: {
  submittedSnapshot: { extraction: string[]; graftHandling: string[]; implantation: string[] } | null;
  defaultsSaved: boolean;
  onSaveDefaults: () => void;
  onContinueWithoutSaving: () => void;
}) {
  const hasExtraction = submittedSnapshot?.extraction.some(Boolean);
  const hasGraft = submittedSnapshot?.graftHandling.some(Boolean);
  const hasImplantation = submittedSnapshot?.implantation.some(Boolean);
  return (
    <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
      <h2 className="text-lg font-semibold text-slate-900">You&apos;re already halfway there</h2>
      <p className="text-sm text-slate-700">
        The structured data you entered can be reused for future audits. Saving it helps you complete the next contribution faster and strengthens your clinic&apos;s presence on HairAudit.
      </p>
      {(hasExtraction || hasGraft || hasImplantation) && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-800">What you completed</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-slate-600">
            {hasExtraction && <li>Extraction: {submittedSnapshot!.extraction.filter(Boolean).join(" · ")}</li>}
            {hasGraft && <li>Graft handling: {submittedSnapshot!.graftHandling.filter(Boolean).join(" · ")}</li>}
            {hasImplantation && <li>Implantation: {submittedSnapshot!.implantation.filter(Boolean).join(" · ")}</li>}
          </ul>
        </div>
      )}
      <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700">
        <li>Save protocols for future audits</li>
        <li>Appear in patient search when your profile is active</li>
        <li>Build credibility over time with verified documentation</li>
      </ul>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href={CREATE_PROFILE_HREF}
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Create / activate clinic profile
        </Link>
        <button
          type="button"
          onClick={onContinueWithoutSaving}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Continue without saving
        </button>
      </div>
      <div className="border-t border-slate-200 pt-4">
        <p className="text-sm font-medium text-slate-700">Save these selections as your clinic defaults?</p>
        <p className="mt-0.5 text-xs text-slate-500">We&apos;ll store them in this browser so future contributions can start with these values.</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onSaveDefaults}
            disabled={defaultsSaved}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {defaultsSaved ? "Defaults saved" : "Save defaults"}
          </button>
          <button
            type="button"
            onClick={onContinueWithoutSaving}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  token: string;
  caseId: string;
  clinicName?: string | null;
  doctorName?: string | null;
};

export default function ContributionPortalForm({ token, caseId, clinicName, doctorName }: Props) {
  // ─── Planning ─────────────────────────────────────────────────────────────
  const [procedureType, setProcedureType] = useState("");
  const [repairCaseFlag, setRepairCaseFlag] = useState("");
  const [plannedGraftCount, setPlannedGraftCount] = useState("");
  const [actualGraftCount, setActualGraftCount] = useState("");
  const [graftCountRange, setGraftCountRange] = useState("");
  const [futureLossPlanning, setFutureLossPlanning] = useState("");
  const [planningDetails, setPlanningDetails] = useState("");

  // ─── Donor & extraction (FUE-relevant) ───────────────────────────────────
  const [extractionMethod, setExtractionMethod] = useState("");
  const [primaryExtractionDevice, setPrimaryExtractionDevice] = useState("");
  const [punchSizesUsed, setPunchSizesUsed] = useState<string[]>([]);
  const [donorQualityRating, setDonorQualityRating] = useState("");
  const [safeDonorZoneAssessed, setSafeDonorZoneAssessed] = useState("");
  const [donorMappingDetails, setDonorMappingDetails] = useState("");

  // ─── Graft handling ───────────────────────────────────────────────────────
  const [primaryHoldingSolution, setPrimaryHoldingSolution] = useState("");
  const [sortingPerformed, setSortingPerformed] = useState("");
  const [graftsKeptHydrated, setGraftsKeptHydrated] = useState("");
  const [outOfBodyTimeCategory, setOutOfBodyTimeCategory] = useState("");
  const [graftHandlingDetails, setGraftHandlingDetails] = useState("");

  // ─── Implantation ─────────────────────────────────────────────────────────
  const [implantationMethod, setImplantationMethod] = useState("");
  const [implantationDevice, setImplantationDevice] = useState("");
  const [implantedBy, setImplantedBy] = useState("");
  const [siteCreationMethod, setSiteCreationMethod] = useState("");
  const [densePackingAttempted, setDensePackingAttempted] = useState("");
  const [implantationDetails, setImplantationDetails] = useState("");

  // ─── Verification ─────────────────────────────────────────────────────────
  const [documentationLevel, setDocumentationLevel] = useState("");
  const [graftCountVerification, setGraftCountVerification] = useState("");
  const [discrepancyDetected, setDiscrepancyDetected] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState("");
  const [verificationFields, setVerificationFields] = useState("");

  // ─── Images ───────────────────────────────────────────────────────────────
  const [optionalImages, setOptionalImages] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Post-submission participation funnel (non-intrusive)
  const [submissionState, setSubmissionState] = useState<"idle" | "success" | "conversion_dismissed">("idle");
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    extraction: string[];
    graftHandling: string[];
    implantation: string[];
  } | null>(null);

  const isFUE = useMemo(
    () => ["fue", "long_hair_fue"].includes(procedureType),
    [procedureType]
  );
  const isFUT = procedureType === "fut";
  const isRepair = repairCaseFlag === "yes" || procedureType === "repair" || procedureType === "scar_revision";

  const togglePunchSize = (value: string) => {
    setPunchSizesUsed((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const onSubmit = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/contribution-portal/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          planningDetails,
          donorMappingDetails,
          graftHandlingDetails,
          implantationDetails,
          verificationFields,
          optionalImages: optionalImages
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          procedureType: procedureType || undefined,
          repairCaseFlag: repairCaseFlag || undefined,
          plannedGraftCount: plannedGraftCount ? Number(plannedGraftCount) : undefined,
          actualGraftCount: actualGraftCount ? Number(actualGraftCount) : undefined,
          graftCountRange: graftCountRange || undefined,
          futureLossPlanning: futureLossPlanning || undefined,
          extractionMethod: extractionMethod || undefined,
          primaryExtractionDevice: primaryExtractionDevice || undefined,
          punchSizesUsed: punchSizesUsed.length ? punchSizesUsed : undefined,
          donorQualityRating: donorQualityRating || undefined,
          safeDonorZoneAssessed: safeDonorZoneAssessed || undefined,
          primaryHoldingSolution: primaryHoldingSolution || undefined,
          sortingPerformed: sortingPerformed || undefined,
          graftsKeptHydrated: graftsKeptHydrated || undefined,
          outOfBodyTimeCategory: outOfBodyTimeCategory || undefined,
          implantationMethod: implantationMethod || undefined,
          implantationDevice: implantationDevice || undefined,
          implantedBy: implantedBy || undefined,
          siteCreationMethod: siteCreationMethod || undefined,
          densePackingAttempted: densePackingAttempted || undefined,
          documentationLevel: documentationLevel || undefined,
          graftCountVerification: graftCountVerification || undefined,
          discrepancyDetected: discrepancyDetected || undefined,
          confidenceLevel: confidenceLevel || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to submit contribution.");
      setMessage({ type: "ok", text: "Contribution submitted." });
      setSubmissionState("success");
      const labelFor = (opts: AuditOption[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
      setSubmittedSnapshot({
        extraction: [
          procedureType && labelFor(PROCEDURE_TYPE_OPTIONS, procedureType),
          extractionMethod && labelFor(EXTRACTION_METHOD_OPTIONS, extractionMethod),
          primaryExtractionDevice && labelFor(EXTRACTION_DEVICE_OPTIONS, primaryExtractionDevice),
          punchSizesUsed.length ? punchSizesUsed.map((v) => labelFor(PUNCH_SIZE_OPTIONS, v)).join(", ") : "",
        ].filter(Boolean),
        graftHandling: [
          primaryHoldingSolution && labelFor(HOLDING_SOLUTION_OPTIONS, primaryHoldingSolution),
          outOfBodyTimeCategory && labelFor(OUT_OF_BODY_TIME_CATEGORY_OPTIONS, outOfBodyTimeCategory),
          sortingPerformed && `Sorting: ${labelFor(YES_NO_UNKNOWN, sortingPerformed)}`,
          graftsKeptHydrated && `Hydrated: ${labelFor(YES_NO_UNKNOWN, graftsKeptHydrated)}`,
        ].filter(Boolean),
        implantation: [
          implantationMethod && labelFor(IMPLANTATION_METHOD_OPTIONS, implantationMethod),
          implantationDevice && labelFor(IMPLANTATION_DEVICE_OPTIONS, implantationDevice),
          implantedBy && labelFor(IMPLANTED_BY_OPTIONS, implantedBy),
          siteCreationMethod && labelFor(SITE_CREATION_METHOD_OPTIONS, siteCreationMethod),
          densePackingAttempted && `Dense packing: ${labelFor(YES_NO_UNKNOWN, densePackingAttempted)}`,
        ].filter(Boolean),
      });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error)?.message ?? "Unable to submit contribution." });
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultsToStorage = () => {
    try {
      const defaults = {
        procedureType: procedureType || undefined,
        extractionMethod: extractionMethod || undefined,
        primaryExtractionDevice: primaryExtractionDevice || undefined,
        punchSizesUsed: punchSizesUsed.length ? punchSizesUsed : undefined,
        primaryHoldingSolution: primaryHoldingSolution || undefined,
        sortingPerformed: sortingPerformed || undefined,
        graftsKeptHydrated: graftsKeptHydrated || undefined,
        outOfBodyTimeCategory: outOfBodyTimeCategory || undefined,
        implantationMethod: implantationMethod || undefined,
        implantationDevice: implantationDevice || undefined,
        implantedBy: implantedBy || undefined,
        siteCreationMethod: siteCreationMethod || undefined,
        densePackingAttempted: densePackingAttempted || undefined,
        savedAt: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CONTRIBUTION_DEFAULTS_KEY, JSON.stringify(defaults));
        setDefaultsSaved(true);
      }
    } catch {
      // ignore
    }
  };


  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Clinic/Doctor Contribution Portal</h1>
      <p className="mt-2 text-sm text-slate-600">
        Use the quick-select options below for fast input; add notes where needed. All fields are optional.
      </p>
      <p className="mt-1.5 text-sm text-slate-500">
        Your contribution strengthens audit accuracy and helps build your clinic&apos;s verified profile on HairAudit.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Case: {caseId} {clinicName ? `| Clinic: ${clinicName}` : ""} {doctorName ? `| Doctor: ${doctorName}` : ""}
      </p>

      {submissionState === "conversion_dismissed" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-sm font-medium text-emerald-800">Thank you.</p>
          <p className="mt-1 text-sm text-emerald-700">Your contribution has been received and will be included in the case review.</p>
        </div>
      )}

      {submissionState === "success" && (
        <PostSubmissionPanel
          submittedSnapshot={submittedSnapshot}
          defaultsSaved={defaultsSaved}
          onSaveDefaults={saveDefaultsToStorage}
          onContinueWithoutSaving={() => setSubmissionState("conversion_dismissed")}
        />
      )}

      {submissionState === "idle" && (
      <>
      <div className="mt-6 space-y-6">
        {/* Planning */}
        <SectionCard title="Planning details">
          <FieldRow>
            <Select
              label="Procedure type"
              value={procedureType}
              onChange={setProcedureType}
              options={PROCEDURE_TYPE_OPTIONS}
              placeholder="Select…"
            />
            <RadioGroup
              label="Repair / corrective case?"
              name="repairCaseFlag"
              value={repairCaseFlag}
              onChange={setRepairCaseFlag}
              options={YES_NO_UNKNOWN}
            />
          </FieldRow>
          <FieldRow>
            <NumberInput
              label="Planned graft count"
              value={plannedGraftCount}
              onChange={setPlannedGraftCount}
              placeholder="e.g. 3500"
            />
            <NumberInput
              label="Actual graft count"
              value={actualGraftCount}
              onChange={setActualGraftCount}
              placeholder="e.g. 3420"
            />
          </FieldRow>
          <Select
            label="Quick range (if exact count unknown)"
            value={graftCountRange}
            onChange={setGraftCountRange}
            options={GRAFT_COUNT_RANGES}
            placeholder="Optional"
          />
          <RadioGroup
            label="Future loss planning considered"
            name="futureLossPlanning"
            value={futureLossPlanning}
            onChange={setFutureLossPlanning}
            options={YES_NO_UNKNOWN}
          />
          {isRepair && (
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Repair case: add any previous surgery or corrective context in the notes below.
            </p>
          )}
          <label className="block text-sm text-slate-700">
            Additional planning notes
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={2}
              value={planningDetails}
              onChange={(e) => setPlanningDetails(e.target.value)}
              placeholder="Zones planned, density goals, hairline strategy…"
            />
          </label>
        </SectionCard>

        {/* Why contribute — mid-form awareness */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Why contribute?</h3>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
            <li>Improves audit accuracy</li>
            <li>Builds your clinic&apos;s verified surgical profile</li>
            <li>Enables visibility in HairAudit search</li>
          </ul>
          <Link
            href={PARTICIPATION_LEARN_HREF}
            className="mt-3 inline-block text-sm font-medium text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-800"
          >
            Learn about clinic participation
          </Link>
        </div>

        {/* Donor & extraction — FUE-specific when applicable */}
        <SectionCard title="Donor mapping & extraction">
          {(isFUE || !procedureType) && (
            <>
              <FieldRow>
                <Select
                  label="Extraction method"
                  value={extractionMethod}
                  onChange={setExtractionMethod}
                  options={EXTRACTION_METHOD_OPTIONS}
                />
                <Select
                  label="Primary extraction device"
                  value={primaryExtractionDevice}
                  onChange={setPrimaryExtractionDevice}
                  options={EXTRACTION_DEVICE_OPTIONS}
                />
              </FieldRow>
              <div>
                <span className="block text-sm font-medium text-slate-700">Punch sizes used</span>
                <p className="text-xs text-slate-500">Select all that apply</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {PUNCH_SIZE_OPTIONS.map((o) => (
                    <label
                      key={o.value}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:border-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={punchSizesUsed.includes(o.value)}
                        onChange={() => togglePunchSize(o.value)}
                        className="rounded border-slate-300"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          {isFUT && (
            <p className="text-xs text-slate-500">FUT: use notes below for strip/slit and closure details.</p>
          )}
          <FieldRow>
            <Select
              label="Donor quality rating"
              value={donorQualityRating}
              onChange={setDonorQualityRating}
              options={DONOR_QUALITY_RATING_OPTIONS}
            />
            <RadioGroup
              label="Safe donor zone assessed"
              name="safeDonorZoneAssessed"
              value={safeDonorZoneAssessed}
              onChange={setSafeDonorZoneAssessed}
              options={YES_NO_UNKNOWN}
            />
          </FieldRow>
          <label className="block text-sm text-slate-700">
            Additional donor / mapping notes
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={2}
              value={donorMappingDetails}
              onChange={(e) => setDonorMappingDetails(e.target.value)}
              placeholder="Donor mapping, distribution, scarring…"
            />
          </label>
        </SectionCard>

        {/* Graft handling */}
        <SectionCard title="Graft handling">
          <FieldRow>
            <Select
              label="Primary holding / storage solution"
              value={primaryHoldingSolution}
              onChange={setPrimaryHoldingSolution}
              options={HOLDING_SOLUTION_OPTIONS}
            />
            <Select
              label="Out-of-body time (est.)"
              value={outOfBodyTimeCategory}
              onChange={setOutOfBodyTimeCategory}
              options={OUT_OF_BODY_TIME_CATEGORY_OPTIONS}
            />
          </FieldRow>
          <RadioGroup
            label="Sorting performed"
            name="sortingPerformed"
            value={sortingPerformed}
            onChange={setSortingPerformed}
            options={YES_NO_UNKNOWN}
          />
          <RadioGroup
            label="Grafts kept hydrated"
            name="graftsKeptHydrated"
            value={graftsKeptHydrated}
            onChange={setGraftsKeptHydrated}
            options={YES_NO_UNKNOWN}
          />
          <label className="block text-sm text-slate-700">
            Additional graft handling notes
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={2}
              value={graftHandlingDetails}
              onChange={(e) => setGraftHandlingDetails(e.target.value)}
              placeholder="Storage duration, temperature control, tray handling…"
            />
          </label>
        </SectionCard>

        {/* Implantation */}
        <SectionCard title="Implantation">
          <FieldRow>
            <Select
              label="Implantation method"
              value={implantationMethod}
              onChange={setImplantationMethod}
              options={IMPLANTATION_METHOD_OPTIONS}
            />
            <Select
              label="Primary implantation device"
              value={implantationDevice}
              onChange={setImplantationDevice}
              options={IMPLANTATION_DEVICE_OPTIONS}
            />
          </FieldRow>
          <FieldRow>
            <Select
              label="Implanted by"
              value={implantedBy}
              onChange={setImplantedBy}
              options={IMPLANTED_BY_OPTIONS}
            />
            <Select
              label="Site creation method"
              value={siteCreationMethod}
              onChange={setSiteCreationMethod}
              options={SITE_CREATION_METHOD_OPTIONS}
            />
          </FieldRow>
          <RadioGroup
            label="Dense packing attempted"
            name="densePackingAttempted"
            value={densePackingAttempted}
            onChange={setDensePackingAttempted}
            options={YES_NO_UNKNOWN}
          />
          <label className="block text-sm text-slate-700">
            Additional implantation notes
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={2}
              value={implantationDetails}
              onChange={(e) => setImplantationDetails(e.target.value)}
              placeholder="Angle/direction strategy, density by zone…"
            />
          </label>
        </SectionCard>

        {/* Verification */}
        <SectionCard title="Verification">
          <FieldRow>
            <Select
              label="Documentation level provided"
              value={documentationLevel}
              onChange={setDocumentationLevel}
              options={DOCUMENTATION_LEVEL_OPTIONS}
              placeholder="Not specified"
            />
            <Select
              label="Graft count verification"
              value={graftCountVerification}
              onChange={setGraftCountVerification}
              options={GRAFT_COUNT_VERIFICATION_OPTIONS}
              placeholder="Not specified"
            />
          </FieldRow>
          <FieldRow>
            <Select
              label="Discrepancy detected (vs. patient/audit)"
              value={discrepancyDetected}
              onChange={setDiscrepancyDetected}
              options={DISCREPANCY_DETECTION_OPTIONS}
              placeholder="Not specified"
            />
            <Select
              label="Confidence in this submission"
              value={confidenceLevel}
              onChange={setConfidenceLevel}
              options={CONFIDENCE_LEVEL_OPTIONS}
              placeholder="Not specified"
            />
          </FieldRow>
          <label className="block text-sm text-slate-700">
            Verification notes, logs, cross-checks, timestamps
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={2}
              value={verificationFields}
              onChange={(e) => setVerificationFields(e.target.value)}
              placeholder="Logs, cross-check references, timestamps…"
            />
          </label>
        </SectionCard>

        {/* Images */}
        <SectionCard title="Optional intra-op / day 0 images">
          <label className="block text-sm text-slate-700">
            Image URLs or paths (one per line)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={2}
              value={optionalImages}
              onChange={(e) => setOptionalImages(e.target.value)}
              placeholder="https://… or path/to/image.jpg"
            />
          </label>
        </SectionCard>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</p>
      )}

      <div className="mt-6">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Contribution"}
        </button>
      </div>
      </>
      )}
    </div>
  );
}
