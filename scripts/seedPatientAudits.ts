/**
 * Development-only seed script for Patient Audits (patient_audit_v2).
 * Generates realistic, randomized patient audit records and inserts into Supabase.
 *
 * Usage: npm run seed:patients -- [--count=30] [--low-quality-clinic] [--high-end-clinic] [--technician-driven] [--inflated-graft-count]
 * (The extra -- is required so npm forwards flags to the script.)
 *
 * Requires: NODE_ENV !== "production", NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Optional: SEED_OWNER_USER_ID (UUID of dev user to own created cases; if missing, script will try to use first case or create cases without owner in dev)
 */

import { tryCreateSupabaseAdminClient } from "../src/lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

// --- Env loading (no dotenv dep): load .env.local into process.env ---
function loadEnvLocal() {
  const root = path.resolve(__dirname, "..");
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/\\"/g, '"') : raw;
    if (!process.env[key]) process.env[key] = val;
  }
}

// --- Types (match patient_audit_v2 schema) ---
type CountryKey =
  | "turkey"
  | "spain"
  | "india"
  | "thailand"
  | "mexico"
  | "brazil"
  | "argentina"
  | "colombia"
  | "australia"
  | "uk"
  | "usa"
  | "canada"
  | "uae"
  | "belgium"
  | "germany"
  | "poland"
  | "greece"
  | "other";
type ProcedureKey = "fue" | "fut" | "dhi" | "robotic" | "not_sure" | "other";
type MonthsSinceKey = "under_3" | "3_6" | "6_9" | "9_12" | "12_plus";
type SurgeryDurationKey = "under_4h" | "4_6h" | "6_8h" | "8_plus";

export type PatientAuditV2Record = {
  clinic_name: string;
  clinic_country: CountryKey;
  clinic_country_other?: string;
  clinic_city: string;
  procedure_date: string;
  procedure_type: ProcedureKey;
  procedure_type_other?: string;
  surgeon_name?: string;
  patient_name?: string;
  preop_consult: "yes" | "no";
  doctor_present_extraction: "yes" | "no" | "not_sure";
  doctor_present_implant: "yes" | "no" | "not_sure";
  graft_number_disclosed: "yes" | "no";
  graft_number_received?: number;
  donor_shaving: "full_shave" | "partial_shave" | "no";
  surgery_duration: SurgeryDurationKey;
  total_paid_currency: string;
  total_paid_currency_other?: string;
  total_paid_amount: number;
  cost_model: "per_graft" | "per_session" | "package" | "not_clear";
  what_included?: string[];
  what_included_other?: string;
  pain_level: number;
  post_op_swelling: "none" | "mild" | "moderate" | "severe";
  bleeding_issue: "yes" | "no" | "not_sure";
  recovery_time: "under_1_week" | "1_2_weeks" | "2_4_weeks" | "4_plus_weeks";
  shock_loss: "yes" | "no" | "not_sure";
  complications: "yes" | "no";
  complications_details?: string;
  months_since: MonthsSinceKey;
  density_satisfaction: number;
  hairline_naturalness: number;
  donor_appearance: number;
  would_repeat: "yes" | "no" | "not_sure";
  would_recommend: "yes" | "no";
};

// --- Weighted random helpers ---
function pick<T>(arr: T[], weights?: number[]): T {
  if (!weights || weights.length !== arr.length) {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return arr[i]!;
  }
  return arr[arr.length - 1]!;
}

/** Normal-ish distribution: mean, std, min, max */
function normalClamp(mean: number, std: number, min: number, max: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const v = mean + std * z;
  return Math.round(Math.max(min, Math.min(max, v)));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinMonths(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(randomInt(1, 28));
  return d.toISOString().slice(0, 10);
}

// --- Scenario flags ---
type ScenarioFlags = {
  lowQualityClinic: boolean;
  highEndClinic: boolean;
  technicianDriven: boolean;
  inflatedGraftCount: boolean;
};

function parseArgs(): { count: number; scenario: ScenarioFlags } {
  const args = process.argv.slice(2);
  let count = randomInt(20, 50);
  const scenario: ScenarioFlags = {
    lowQualityClinic: false,
    highEndClinic: false,
    technicianDriven: false,
    inflatedGraftCount: false,
  };
  for (const a of args) {
    if (a.startsWith("--count=")) {
      const n = parseInt(a.slice("--count=".length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 200) count = n;
    } else if (a === "--low-quality-clinic") scenario.lowQualityClinic = true;
    else if (a === "--high-end-clinic") scenario.highEndClinic = true;
    else if (a === "--technician-driven") scenario.technicianDriven = true;
    else if (a === "--inflated-graft-count") scenario.inflatedGraftCount = true;
  }
  return { count, scenario };
}

// --- Country / currency / price ranges (realistic per country) ---
const COUNTRY_WEIGHTS: [CountryKey, number][] = [
  ["turkey", 60],
  ["uk", 15],
  ["spain", 10],
  ["india", 3],
  ["mexico", 2],
  ["thailand", 2],
  ["usa", 2],
  ["germany", 1],
  ["belgium", 1],
  ["uae", 1],
  ["canada", 1],
  ["australia", 0.5],
  ["poland", 0.5],
  ["greece", 0.5],
  ["brazil", 0.5],
  ["colombia", 0.3],
  ["argentina", 0.2],
  ["other", 0.5],
];

const DEFAULT_CURRENCY_BY_COUNTRY: Record<string, string> = {
  turkey: "usd",
  uk: "gbp",
  spain: "eur",
  india: "inr",
  thailand: "thb",
  mexico: "mxn",
  usa: "usd",
  canada: "usd",
  australia: "aud",
  germany: "eur",
  belgium: "eur",
  poland: "eur",
  greece: "eur",
  uae: "usd",
  brazil: "usd",
  colombia: "usd",
  argentina: "usd",
};

/** Price range in USD equivalent (min, max) per country for realism */
const PRICE_RANGE_USD: Record<string, [number, number]> = {
  turkey: [1200, 3500],
  uk: [4000, 12000],
  spain: [2500, 7000],
  india: [1500, 4500],
  thailand: [2000, 5000],
  mexico: [2000, 5500],
  usa: [5000, 18000],
  canada: [5000, 15000],
  australia: [6000, 14000],
  germany: [3500, 9000],
  belgium: [3500, 9000],
  poland: [2500, 6000],
  greece: [2500, 6000],
  uae: [3000, 8000],
  brazil: [2000, 6000],
  colombia: [2000, 5000],
  argentina: [2000, 5000],
  other: [2000, 8000],
};

const CITIES: Record<string, string[]> = {
  turkey: ["Istanbul", "Ankara", "Izmir", "Antalya"],
  uk: ["London", "Manchester", "Birmingham", "Leeds"],
  spain: ["Madrid", "Barcelona", "Valencia", "Malaga"],
  india: ["Mumbai", "Delhi", "Bangalore", "Hyderabad"],
  thailand: ["Bangkok", "Phuket"],
  mexico: ["Tijuana", "Cancun", "Mexico City", "Guadalajara"],
  usa: ["New York", "Los Angeles", "Miami", "Dallas"],
  canada: ["Toronto", "Vancouver", "Montreal"],
  australia: ["Sydney", "Melbourne", "Brisbane"],
  germany: ["Berlin", "Munich", "Frankfurt", "Cologne"],
  belgium: ["Brussels", "Antwerp"],
  poland: ["Warsaw", "Krakow", "Wroclaw"],
  greece: ["Athens", "Thessaloniki"],
  uae: ["Dubai", "Abu Dhabi"],
  brazil: ["São Paulo", "Rio de Janeiro", "Curitiba"],
  colombia: ["Bogotá", "Medellín"],
  argentina: ["Buenos Aires", "Córdoba"],
  other: ["Other City"],
};

// --- Generate one record ---
function generateOne(scenario: ScenarioFlags): PatientAuditV2Record {
  const countries = COUNTRY_WEIGHTS.map(([c]) => c);
  const weights = COUNTRY_WEIGHTS.map(([, w]) => w);
  const clinic_country = pick(countries, weights);

  const procedureTypes: ProcedureKey[] = ["fue", "fut", "dhi", "robotic", "not_sure", "other"];
  const procedureWeights = scenario.lowQualityClinic
    ? [0.5, 0.2, 0.15, 0.05, 0.08, 0.02]
    : scenario.highEndClinic
      ? [0.4, 0.1, 0.25, 0.2, 0.03, 0.02]
      : [0.65, 0.12, 0.12, 0.06, 0.04, 0.01];
  const procedure_type = pick(procedureTypes, procedureWeights);

  const monthsOptions: MonthsSinceKey[] = ["under_3", "3_6", "6_9", "9_12", "12_plus"];
  const monthsWeights = [0.05, 0.15, 0.25, 0.25, 0.3];
  const months_since = pick(monthsOptions, monthsWeights);

  const density_satisfaction = normalClamp(
    scenario.lowQualityClinic ? 2.5 : scenario.highEndClinic ? 4.2 : 3.5,
    scenario.lowQualityClinic ? 1.2 : 0.9,
    1,
    5
  );
  const hairline_naturalness = normalClamp(density_satisfaction, 0.8, 1, 5);
  const donor_appearance = normalClamp(density_satisfaction, 0.7, 1, 5);

  const complicationRate = scenario.lowQualityClinic ? 0.25 : scenario.highEndClinic ? 0.05 : 0.12;
  const complications: "yes" | "no" = Math.random() < complicationRate ? "yes" : "no";

  const doctorNotSureChance = scenario.technicianDriven ? 0.45 : 0.2;
  const doctor_present_extraction: "yes" | "no" | "not_sure" =
    Math.random() < doctorNotSureChance
      ? "not_sure"
      : Math.random() < 0.7
        ? "yes"
        : "no";
  const doctor_present_implant: "yes" | "no" | "not_sure" =
    Math.random() < doctorNotSureChance
      ? "not_sure"
      : Math.random() < 0.65
        ? "yes"
        : "no";

  let graft_number_received: number;
  if (scenario.inflatedGraftCount) {
    graft_number_received = randomInt(3500, 5500);
  } else {
    graft_number_received = randomInt(1500, 4500);
  }
  const graft_number_disclosed: "yes" | "no" = Math.random() < 0.88 ? "yes" : "no";
  const effectiveGraftCount = graft_number_disclosed === "no" ? undefined : graft_number_received;

  const [minUsd, maxUsd] = PRICE_RANGE_USD[clinic_country] ?? PRICE_RANGE_USD.other;
  let total_paid_amount = randomInt(minUsd, maxUsd);
  if (scenario.highEndClinic) total_paid_amount = randomInt(Math.max(minUsd, 5000), maxUsd + 3000);
  if (scenario.lowQualityClinic) total_paid_amount = randomInt(800, Math.min(maxUsd, 2500));

  const currency = DEFAULT_CURRENCY_BY_COUNTRY[clinic_country] ?? "usd";
  const cities = CITIES[clinic_country] ?? CITIES.other;
  const clinic_city = pick(cities);
  const clinicNameSuffix = randomInt(1, 999);
  const clinic_name = `Seed Clinic ${clinic_city} ${clinicNameSuffix}`;

  const monthsAgoMap: Record<MonthsSinceKey, number> = {
    under_3: 2,
    "3_6": 4,
    "6_9": 7,
    "9_12": 10,
    "12_plus": 14,
  };
  const procedure_date = randomDateWithinMonths(monthsAgoMap[months_since]);

  const surgeryDurations: SurgeryDurationKey[] = ["under_4h", "4_6h", "6_8h", "8_plus"];
  const graftForDuration = effectiveGraftCount ?? 2500;
  const graftToDuration =
    graftForDuration < 2000
      ? [0.4, 0.4, 0.15, 0.05]
      : graftForDuration < 3000
        ? [0.1, 0.5, 0.35, 0.05]
        : graftForDuration < 4000
          ? [0.05, 0.35, 0.45, 0.15]
          : [0.02, 0.2, 0.48, 0.3];
  const surgery_duration = pick(surgeryDurations, graftToDuration);

  const would_repeat: "yes" | "no" | "not_sure" =
    density_satisfaction >= 4 ? "yes" : density_satisfaction <= 2 ? "no" : pick(["yes", "no", "not_sure"], [0.4, 0.2, 0.4]);
  const would_recommend: "yes" | "no" = would_repeat === "yes" ? "yes" : would_repeat === "no" ? "no" : Math.random() < 0.5 ? "yes" : "no";

  const out: PatientAuditV2Record = {
    clinic_name,
    clinic_country,
    clinic_city,
    procedure_date,
    procedure_type,
    surgeon_name: Math.random() < 0.6 ? `Dr. Seed ${randomInt(1, 99)}` : undefined,
    patient_name: undefined,
    preop_consult: pick(["yes", "no"], scenario.lowQualityClinic ? [0.6, 0.4] : [0.9, 0.1]),
    doctor_present_extraction,
    doctor_present_implant,
    graft_number_disclosed,
    graft_number_received: effectiveGraftCount,
    donor_shaving: pick(["full_shave", "partial_shave", "no"], [0.75, 0.2, 0.05]),
    surgery_duration,
    total_paid_currency: currency,
    total_paid_amount,
    cost_model: pick(["per_graft", "per_session", "package", "not_clear"], [0.5, 0.2, 0.25, 0.05]),
    what_included: (() => {
      const opts = ["procedure", "medications", "followup", "prp", "accommodation", "transport"];
      const n = randomInt(2, 5);
      const shuffled = [...opts].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    })(),
    pain_level: normalClamp(3, 1.8, 1, 10),
    post_op_swelling: pick(["none", "mild", "moderate", "severe"], [0.2, 0.5, 0.25, 0.05]),
    bleeding_issue: pick(["yes", "no", "not_sure"], [0.05, 0.9, 0.05]),
    recovery_time: pick(["under_1_week", "1_2_weeks", "2_4_weeks", "4_plus_weeks"], [0.3, 0.4, 0.25, 0.05]),
    shock_loss: pick(["yes", "no", "not_sure"], [0.35, 0.55, 0.1]),
    complications,
    complications_details: complications === "yes" ? "Seed: minor infection / prolonged redness" : undefined,
    months_since,
    density_satisfaction,
    hairline_naturalness,
    donor_appearance,
    would_repeat,
    would_recommend,
  };
  if (clinic_country === "other") out.clinic_country_other = "Portugal";
  if (procedure_type === "other") out.procedure_type_other = "Combined";
  if (currency === "other") out.total_paid_currency_other = "CHF";
  return out;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Aborting: seed script must not run in production (NODE_ENV=production).");
    process.exit(1);
  }

  loadEnvLocal();

  const supabase = tryCreateSupabaseAdminClient();
  if (!supabase) {
    console.error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required."
    );
    process.exit(1);
  }

  const ownerId = process.env.SEED_OWNER_USER_ID;
  if (!ownerId) {
    console.warn("SEED_OWNER_USER_ID not set. Will try to use an existing case or create cases with a placeholder; for best results set it to a dev user UUID.");
  }

  const { count, scenario } = parseArgs();
  console.log(`Seeding ${count} patient audit(s). Scenario flags:`, scenario);

  let ownerUserId: string | null = ownerId ?? null;
  if (!ownerUserId) {
    const { data: firstCase } = await supabase
      .from("cases")
      .select("user_id")
      .limit(1)
      .maybeSingle();
    if (firstCase?.user_id) {
      ownerUserId = firstCase.user_id as string;
      console.log("Using existing case owner as SEED_OWNER_USER_ID:", ownerUserId);
    }
  }
  if (!ownerUserId) {
    const { data: profile } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
    if (profile?.id) {
      ownerUserId = profile.id as string;
      console.log("Using first profile id as case owner:", ownerUserId);
    }
  }
  if (!ownerUserId) {
    console.error(
      "No SEED_OWNER_USER_ID and no existing cases/profiles found. Create a dev user and set SEED_OWNER_USER_ID, or run the app once to create a case."
    );
    process.exit(1);
  }

  const inserted: { caseId: string; reportId: string; audit: PatientAuditV2Record }[] = [];

  for (let i = 0; i < count; i++) {
    const audit = generateOne(scenario);
    const summary = {
      patient_answers: audit,
      patient_answers_updated_at: new Date().toISOString(),
    };

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .insert({
        user_id: ownerUserId,
        title: "Patient Audit",
        status: "draft",
        patient_id: ownerUserId,
      })
      .select("id")
      .single();

    if (caseErr) {
      console.error("Case insert error:", caseErr.message);
      throw caseErr;
    }

    const caseId = (caseRow as { id: string }).id;

    const { data: reportRow, error: reportErr } = await supabase
      .from("reports")
      .insert({
        case_id: caseId,
        version: 1,
        summary,
        pdf_path: "",
        status: "complete",
        patient_audit_version: 2,
        patient_audit_v2: audit as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (reportErr) {
      console.error("Report insert error:", reportErr.message);
      if (String(reportErr.message).includes("patient_audit")) {
        console.error("Hint: Ensure Supabase migrations are applied (reports.patient_audit_version, reports.patient_audit_v2).");
      }
      await supabase.from("cases").delete().eq("id", caseId);
      throw reportErr;
    }

    inserted.push({
      caseId,
      reportId: (reportRow as { id: string }).id,
      audit,
    });
  }

  console.log(`Inserted ${inserted.length} patient audit(s).`);
  if (inserted.length > 0) {
    const ex = inserted[0]!;
    console.log("Example record (first):", JSON.stringify({ caseId: ex.caseId, reportId: ex.reportId, audit: ex.audit }, null, 2));
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
