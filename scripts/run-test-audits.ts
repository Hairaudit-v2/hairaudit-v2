/**
 * scripts/run-test-audits.ts
 *
 * Run automated “test patient uploads” (non-production only).
 *
 * Usage:
 *   pnpm tsx scripts/run-test-audits.ts --n 25
 *
 * Required env:
 *   - ALLOW_TEST_AUDITS=true
 *   - NODE_ENV !== "production"
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - INNGEST_EVENT_KEY (unless --dry-run)
 *
 * Optional env:
 *   - CASE_FILES_BUCKET (default "case-files")
 *   - TEST_AUDITS_OWNER_USER_ID (Supabase user UUID to own created cases)
 */
/* eslint-disable no-console */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "../src/lib/inngest/client";
import { type PatientPhotoCategory } from "../src/lib/photoCategories";
import { validatePatientAuditV2, type PatientAuditV2 } from "../src/lib/patientAuditSchema";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { cleanupTestCases, createTestPatientAndCase } from "./lib/testCaseFactory";

type CliOptions = {
  n: number;
  folder: string;
  concurrency: number;
  dryRun: boolean;
  cleanup: boolean;
};

type RunOutcome =
  | {
      ok: true;
      caseId: string;
      country: string;
      procedureType: string;
      claimedGrafts: number;
      overallScore: number | null;
      confidence: number | null;
      createdAt: string | null;
      pdfPath: string | null;
      outputDir: string;
    }
  | {
      ok: false;
      caseId: string;
      country: string;
      procedureType: string;
      claimedGrafts: number;
      outputDir: string;
      error: string;
    };

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

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const defaults: CliOptions = {
    n: 25,
    folder: "G:\\hairaudit-v2\\hairaudit-v2\\testimages",
    concurrency: 3,
    dryRun: false,
    cleanup: false,
  };

  const out: CliOptions = { ...defaults };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--cleanup") {
      out.cleanup = true;
    } else if (a === "--n") {
      const v = args[i + 1];
      if (v) {
        const n = parseInt(v, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 200) out.n = n;
        i++;
      }
    } else if (a.startsWith("--n=")) {
      const n = parseInt(a.slice("--n=".length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 200) out.n = n;
    } else if (a === "--folder") {
      const v = args[i + 1];
      if (v) {
        out.folder = v;
        i++;
      }
    } else if (a.startsWith("--folder=")) {
      out.folder = a.slice("--folder=".length);
    } else if (a === "--concurrency") {
      const v = args[i + 1];
      if (v) {
        const n = parseInt(v, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 10) out.concurrency = n;
        i++;
      }
    } else if (a.startsWith("--concurrency=")) {
      const n = parseInt(a.slice("--concurrency=".length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 10) out.concurrency = n;
    }
  }

  // Keep concurrency sane by default (2–3)
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) out.concurrency = defaults.concurrency;
  if (out.concurrency > 5) out.concurrency = 5;

  return out;
}

function assertSafetyOrExit() {
  if (process.env.NODE_ENV === "production") {
    console.error("Aborting: this script must not run in production (NODE_ENV=production).");
    process.exit(1);
  }
  if (String(process.env.ALLOW_TEST_AUDITS ?? "").toLowerCase() !== "true") {
    console.error("Aborting: set ALLOW_TEST_AUDITS=true to run this script.");
    process.exit(1);
  }
}

function pick<T>(arr: ReadonlyArray<T>, weights?: ReadonlyArray<number>): T {
  if (!weights || weights.length !== arr.length) return arr[Math.floor(Math.random() * arr.length)]!;
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return arr[i]!;
  }
  return arr[arr.length - 1]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function walkImages(root: string): Promise<string[]> {
  const exts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const out: string[] = [];

  async function walk(dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (exts.has(ext)) out.push(p);
      }
    }
  }

  await walk(root);
  return out;
}

type FilenameTag =
  | "donor_rear"
  | "donor_sides"
  | "front"
  | "crown"
  | "top"
  | "postop_day0"
  | "intraop"
  | "any";

function pickAnyFallbackCategory(): PatientPhotoCategory {
  // Strict enum safety: pick a valid category even when filename gives no clue.
  // Bias toward optional categories so we don't over-stuff required buckets.
  const candidates: PatientPhotoCategory[] = [
    "preop_left",
    "preop_right",
    "preop_crown",
    "day0_recipient",
    "day0_donor",
    "postop_day0",
    "intraop",
  ];
  const weights = [1.3, 1.3, 1.1, 0.9, 0.9, 0.7, 0.6];
  return pick(candidates, weights);
}

function categorizeByFilename(filePath: string): { tag: FilenameTag; category: PatientPhotoCategory } {
  const b = path.basename(filePath).toLowerCase();
  const has = (re: RegExp) => re.test(b);

  const hasDonor = has(/\bdonor\b/);

  // Heuristic rules (case-insensitive, based on filename contains)
  // "donor" + ("rear"|"back") -> donor_rear
  if (hasDonor && (has(/\brear\b/) || has(/\bback\b/))) {
    return { tag: "donor_rear", category: "preop_donor_rear" };
  }

  // "donor" + ("side"|"left"|"right") -> donor_sides
  if (hasDonor && (has(/\bside\b/) || has(/\bleft\b/) || has(/\bright\b/))) {
    const side: PatientPhotoCategory =
      has(/\bleft\b/) ? "preop_left" : has(/\bright\b/) ? "preop_right" : pick(["preop_left", "preop_right"]);
    return { tag: "donor_sides", category: side };
  }

  // "front" -> preop_front
  if (has(/\bfront\b/)) return { tag: "front", category: "preop_front" };

  // "crown" -> preop_crown
  if (has(/\bcrown\b/)) return { tag: "crown", category: "preop_crown" };

  // "top" -> preop_top
  if (has(/\btop\b/)) return { tag: "top", category: "preop_top" };

  // "day0" -> postop_day0
  if (has(/\bday0\b/) || has(/\bday_?0\b/)) return { tag: "postop_day0", category: "postop_day0" };

  // "intra" -> intraop
  if (has(/\bintra\b/) || has(/\bintraop\b/)) return { tag: "intraop", category: "intraop" };

  return { tag: "any", category: pickAnyFallbackCategory() };
}

function toCountryKey(c: string): PatientAuditV2["clinic_country"] {
  const k = c.trim().toLowerCase();
  // patientAuditSchema uses lowercase keys
  if (k === "usa" || k === "us" || k === "united states") return "usa";
  if (k === "uk" || k === "united kingdom") return "uk";
  if (k === "uae") return "uae";
  const allowed = new Set([
    "turkey",
    "spain",
    "india",
    "thailand",
    "mexico",
    "brazil",
    "argentina",
    "colombia",
    "australia",
    "uk",
    "usa",
    "canada",
    "uae",
    "belgium",
    "germany",
    "poland",
    "greece",
    "other",
  ] as const);
  return (allowed.has(k as any) ? (k as any) : "other") as PatientAuditV2["clinic_country"];
}

function nowIsoDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomProcedureDateFromMonthsSince(monthsSince: PatientAuditV2["months_since"]): string {
  const monthsAgoMap: Record<PatientAuditV2["months_since"], number> = {
    under_3: 2,
    "3_6": 4,
    "6_9": 7,
    "9_12": 10,
    "12_plus": 14,
  };
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgoMap[monthsSince]);
  d.setDate(randomInt(1, 28));
  return d.toISOString().slice(0, 10);
}

function generateRandomPatientAnswers(): {
  displayCountry: string;
  procedureTypeDisplay: string;
  claimedGrafts: number;
  smoking: "No" | "Occasionally" | "Daily";
  sexAssignedAtBirth: "Male" | "Female";
  age: number;
  monthsSince: PatientAuditV2["months_since"];
  patientAnswers: PatientAuditV2 & {
    enhanced_patient_answers?: Record<string, unknown>;
    patient_baseline?: Record<string, unknown>;
  };
} {
  const countries = [
    "Turkey",
    "Spain",
    "India",
    "Thailand",
    "Mexico",
    "Brazil",
    "Argentina",
    "Colombia",
    "Australia",
    "UK",
    "USA",
    "Canada",
    "UAE",
    "Belgium",
    "Germany",
    "Poland",
    "Greece",
  ];
  const displayCountry = pick(countries);
  const clinic_country = toCountryKey(displayCountry);

  const age = randomInt(21, 62);
  const sexAssignedAtBirth = pick(["Male", "Female"] as const, [0.8, 0.2]);
  const smoking = pick(["No", "Occasionally", "Daily"] as const, [0.6, 0.25, 0.15]);

  const procedureTypesDisplay = ["FUE", "DHI", "FUT", "Robotic", "Not Sure"] as const;
  const procedureTypeDisplay = pick(procedureTypesDisplay, [0.55, 0.15, 0.12, 0.08, 0.1]);
  const procedure_type: PatientAuditV2["procedure_type"] =
    procedureTypeDisplay === "FUE"
      ? "fue"
      : procedureTypeDisplay === "DHI"
        ? "dhi"
        : procedureTypeDisplay === "FUT"
          ? "fut"
          : procedureTypeDisplay === "Robotic"
            ? "robotic"
            : "not_sure";

  const claimedGrafts = randomInt(1200, 4200);
  const monthsSince = pick(
    ["under_3", "3_6", "6_9", "9_12", "12_plus"] as const,
    // Weighted to 6–12
    [0.05, 0.15, 0.3, 0.3, 0.2]
  );

  const clinic_city_by_country: Record<string, string[]> = {
    turkey: ["Istanbul", "Ankara", "Izmir", "Antalya"],
    spain: ["Madrid", "Barcelona", "Valencia", "Malaga"],
    india: ["Mumbai", "Delhi", "Bangalore", "Hyderabad"],
    thailand: ["Bangkok", "Phuket"],
    mexico: ["Tijuana", "Cancun", "Mexico City", "Guadalajara"],
    brazil: ["São Paulo", "Rio de Janeiro", "Curitiba"],
    argentina: ["Buenos Aires", "Córdoba"],
    colombia: ["Bogotá", "Medellín"],
    australia: ["Sydney", "Melbourne", "Brisbane"],
    uk: ["London", "Manchester", "Birmingham", "Leeds"],
    usa: ["New York", "Los Angeles", "Miami", "Dallas"],
    canada: ["Toronto", "Vancouver", "Montreal"],
    uae: ["Dubai", "Abu Dhabi"],
    belgium: ["Brussels", "Antwerp"],
    germany: ["Berlin", "Munich", "Frankfurt", "Cologne"],
    poland: ["Warsaw", "Krakow", "Wroclaw"],
    greece: ["Athens", "Thessaloniki"],
    other: ["Other City"],
  };

  const cities = clinic_city_by_country[clinic_country] ?? clinic_city_by_country.other;
  const clinic_city = pick(cities);
  const clinic_name = `Test Clinic ${clinic_city} ${randomInt(1, 999)}`;
  const procedure_date = randomProcedureDateFromMonthsSince(monthsSince);
  const surgeon_name = Math.random() < 0.65 ? `Dr. Test ${randomInt(1, 99)}` : undefined;

  const disclosed = Math.random() < 0.9 ? "yes" : "no";
  const graft_number_received = disclosed === "yes" ? claimedGrafts : undefined;

  const patientAnswers: PatientAuditV2 & {
    enhanced_patient_answers?: Record<string, unknown>;
    patient_baseline?: Record<string, unknown>;
  } = {
    clinic_name,
    clinic_country,
    clinic_city,
    procedure_date,
    procedure_type,
    surgeon_name,
    patient_name: undefined,

    preop_consult: Math.random() < 0.85 ? "yes" : "no",
    doctor_present_extraction: pick(["yes", "no", "not_sure"] as const, [0.6, 0.25, 0.15]),
    doctor_present_implant: pick(["yes", "no", "not_sure"] as const, [0.55, 0.25, 0.2]),
    graft_number_disclosed: disclosed,
    graft_number_received,
    donor_shaving: pick(["full_shave", "partial_shave", "no"] as const, [0.75, 0.2, 0.05]),
    surgery_duration: pick(["under_4h", "4_6h", "6_8h", "8_plus"] as const, [0.12, 0.45, 0.33, 0.1]),

    total_paid_currency: pick(["usd", "eur", "gbp"] as const, [0.65, 0.25, 0.1]),
    total_paid_amount: randomInt(1200, 16000),
    cost_model: pick(["per_graft", "per_session", "package", "not_clear"] as const, [0.5, 0.2, 0.25, 0.05]),
    what_included: shuffle(["procedure", "medications", "followup", "accommodation", "transport", "prp"]).slice(
      0,
      randomInt(2, 5)
    ),

    pain_level: randomInt(1, 7),
    post_op_swelling: pick(["none", "mild", "moderate", "severe"] as const, [0.2, 0.52, 0.23, 0.05]),
    bleeding_issue: pick(["yes", "no", "not_sure"] as const, [0.06, 0.9, 0.04]),

    recovery_time: pick(["under_1_week", "1_2_weeks", "2_4_weeks", "4_plus_weeks"] as const, [0.3, 0.42, 0.23, 0.05]),
    shock_loss: pick(["yes", "no", "not_sure"] as const, [0.3, 0.6, 0.1]),
    complications: Math.random() < 0.12 ? "yes" : "no",
    complications_details: undefined,

    months_since: monthsSince,
    density_satisfaction: randomInt(1, 5),
    hairline_naturalness: randomInt(1, 5),
    donor_appearance: randomInt(1, 5),
    would_repeat: pick(["yes", "no", "not_sure"] as const, [0.45, 0.2, 0.35]),
    would_recommend: Math.random() < 0.7 ? "yes" : "no",
  };

  if (patientAnswers.complications === "yes") {
    patientAnswers.complications_details = pick([
      "Prolonged redness for ~2 weeks",
      "Minor infection treated with antibiotics",
      "Unusual swelling for several days",
    ]);
  }

  // Advanced forensic intake (optional, nested). This matches the AI audit input expectations.
  patientAnswers.enhanced_patient_answers = {
    baseline: {
      patient_age: age,
      patient_sex: sexAssignedAtBirth,
      smoking_status: smoking,
      alcohol_frequency: pick(["Rare", "Weekly", "Daily"] as const, [0.6, 0.35, 0.05]),
      diabetes: pick(["No", "Type2", "Not sure"] as const, [0.9, 0.06, 0.04]),
    },
    procedure_execution: {
      grafts_claimed_total: claimedGrafts,
      technician_role_extraction: pick(["Doctor", "Technician", "Mixed", "Not sure"] as const, [0.25, 0.35, 0.25, 0.15]),
      technician_role_implantation: pick(["Doctor", "Technician", "Mixed", "Not sure"] as const, [0.25, 0.35, 0.25, 0.15]),
      hairline_drawn_by_doctor: pick(["Yes", "Technician", "Not sure"] as const, [0.55, 0.1, 0.35]),
      single_hair_grafts_front: pick(["Yes", "No", "Not sure"] as const, [0.4, 0.25, 0.35]),
      crown_pattern_discussed: pick(["Yes", "No", "Not sure"] as const, [0.5, 0.3, 0.2]),
    },
    experience: {
      communication_rating: pick([1, 2, 3, 4, 5] as const, [0.05, 0.1, 0.25, 0.35, 0.25]),
      transparency_rating: pick([1, 2, 3, 4, 5] as const, [0.05, 0.1, 0.25, 0.35, 0.25]),
      felt_rushed: Math.random() < 0.25,
      felt_informed: pick(["Yes", "Somewhat", "No"] as const, [0.5, 0.35, 0.15]),
      legal_or_refund_dispute: pick(["No", "Ongoing", "Resolved"] as const, [0.92, 0.05, 0.03]),
      current_satisfaction: randomInt(3, 9),
      biggest_concern_now: pick([
        "Hairline looks slightly unnatural",
        "Density is lower than expected",
        "Donor area looks patchy",
        "Unsure about growth timeline",
      ]),
      considering_revision: pick(["Yes", "No", "Unsure"] as const, [0.25, 0.45, 0.3]),
    },
  };

  patientAnswers.patient_baseline = {
    patient_age: age,
    patient_sex: sexAssignedAtBirth,
    smoking_status: smoking,
  };

  const err = validatePatientAuditV2(patientAnswers as unknown as Record<string, unknown>);
  if (err) {
    // If we accidentally generated invalid v2 answers, fall back to a minimal valid payload.
    const fallback: PatientAuditV2 = {
      clinic_name,
      clinic_country,
      clinic_city,
      procedure_date: nowIsoDateOnly(),
      procedure_type: "not_sure",
      preop_consult: "yes",
      doctor_present_extraction: "not_sure",
      doctor_present_implant: "not_sure",
      graft_number_disclosed: "no",
      donor_shaving: "full_shave",
      surgery_duration: "4_6h",
      total_paid_currency: "usd",
      total_paid_amount: 2500,
      cost_model: "package",
      pain_level: 3,
      post_op_swelling: "mild",
      bleeding_issue: "no",
      recovery_time: "1_2_weeks",
      shock_loss: "not_sure",
      complications: "no",
      months_since: "6_9",
      density_satisfaction: 3,
      hairline_naturalness: 3,
      donor_appearance: 3,
      would_repeat: "not_sure",
      would_recommend: "yes",
    };
    return {
      displayCountry,
      procedureTypeDisplay,
      claimedGrafts,
      smoking,
      sexAssignedAtBirth,
      age,
      monthsSince,
      patientAnswers: {
        ...fallback,
        enhanced_patient_answers: patientAnswers.enhanced_patient_answers,
        patient_baseline: patientAnswers.patient_baseline,
      },
    };
  }

  return {
    displayCountry,
    procedureTypeDisplay,
    claimedGrafts,
    smoking,
    sexAssignedAtBirth,
    age,
    monthsSince,
    patientAnswers,
  };
}

function chooseImageSet(
  allImages: string[]
): Array<{ filePath: string; uploadCategory: PatientPhotoCategory; filename_tag: FilenameTag; forced_required?: boolean }> {
  const desired = Math.min(randomInt(8, 14), Math.max(8, allImages.length));
  const shuffled = shuffle(allImages);

  const categorized = shuffled.map((filePath) => {
    const c = categorizeByFilename(filePath);
    return { filePath, uploadCategory: c.category, filename_tag: c.tag as FilenameTag };
  });

  const donorCandidates = categorized.filter((p) => p.filename_tag === "donor_rear").map((p) => p.filePath);
  const topCandidates = categorized.filter((p) => p.filename_tag === "top").map((p) => p.filePath);
  const frontCandidates = categorized.filter((p) => p.filename_tag === "front").map((p) => p.filePath);

  const byPath = new Map(categorized.map((c) => [c.filePath, c] as const));

  const picked = new Set<string>();
  const picks: Array<{ filePath: string; uploadCategory: PatientPhotoCategory; filename_tag: FilenameTag; forced_required?: boolean }> = [];

  const pickOne = (cands: string[], fallback: string[]): string | null => {
    for (const p of cands) if (!picked.has(p)) return p;
    for (const p of fallback) if (!picked.has(p)) return p;
    return fallback[0] ?? cands[0] ?? null;
  };

  const donor = pickOne(donorCandidates, shuffled);
  const top = pickOne(topCandidates, shuffled);
  const front = pickOne(frontCandidates, shuffled);

  if (donor) {
    picked.add(donor);
    const c = byPath.get(donor);
    if (c) picks.push({ filePath: donor, uploadCategory: c.uploadCategory, filename_tag: c.filename_tag });
  }
  if (top) {
    picked.add(top);
    const c = byPath.get(top);
    if (c) picks.push({ filePath: top, uploadCategory: c.uploadCategory, filename_tag: c.filename_tag });
  }
  if (front) {
    picked.add(front);
    const c = byPath.get(front);
    if (c) picks.push({ filePath: front, uploadCategory: c.uploadCategory, filename_tag: c.filename_tag });
  }

  // ✅ Enforce required patient categories for audit pipeline compatibility.
  // The AI audit requires (after normalization) Current Front, Top, Donor rear.
  const required: PatientPhotoCategory[] = ["preop_front", "preop_top", "preop_donor_rear"];
  const have = new Set(picks.map((p) => p.uploadCategory));

  for (const req of required) {
    if (have.has(req)) continue;

    // Prefer: a file whose filename tag matches, but force the category even if filename doesn't.
    const desiredTag: FilenameTag =
      req === "preop_front" ? "front" : req === "preop_top" ? "top" : "donor_rear";

    const candidate =
      categorized.find((c) => !picked.has(c.filePath) && c.filename_tag === desiredTag) ??
      categorized.find((c) => !picked.has(c.filePath)) ??
      null;

    if (candidate) {
      picked.add(candidate.filePath);
      picks.push({
        filePath: candidate.filePath,
        uploadCategory: req,
        filename_tag: candidate.filename_tag,
        forced_required: candidate.uploadCategory !== req,
      });
      have.add(req);
      continue;
    }

    // If we can't add a new file, repurpose an existing pick that isn't already one of the required ones.
    const repurposeIdx = picks.findIndex((p) => !required.includes(p.uploadCategory));
    if (repurposeIdx >= 0) {
      picks[repurposeIdx] = { ...picks[repurposeIdx]!, uploadCategory: req, forced_required: true };
      have.add(req);
    }
  }

  // Fill remaining images with filename-based categorization (fallback to safe enum).
  const remaining = desired - picks.length;
  const rest = categorized.filter((p) => !picked.has(p.filePath)).slice(0, Math.max(0, remaining));

  for (const p of rest) {
    picks.push({ filePath: p.filePath, uploadCategory: p.uploadCategory, filename_tag: p.filename_tag });
  }

  // If we still don't have minimum 8 images (e.g. too few files), allow repeats.
  while (picks.length < 8 && allImages.length > 0) {
    const p = pick(allImages);
    const c = categorizeByFilename(p);
    picks.push({ filePath: p, uploadCategory: c.category, filename_tag: c.tag });
  }

  return picks.slice(0, Math.max(0, desired));
}

async function ensureDirs(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

function toCsvValue(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function writeJson(p: string, obj: unknown) {
  await ensureDirs(path.dirname(p));
  await fsp.writeFile(p, JSON.stringify(obj, null, 2), "utf8");
}

function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function upsertDraftAnswers(supabase: SupabaseClient, caseId: string, patientAnswers: Record<string, unknown>) {
  const summary = {
    patient_answers: patientAnswers,
    patient_answers_updated_at: new Date().toISOString(),
  };

  // Prefer storing v2 columns when present, but stay backward compatible if migrations aren't applied.
  const payload: Record<string, unknown> = {
    case_id: caseId,
    version: 1,
    summary,
    pdf_path: "",
    // IMPORTANT: this is a draft answers row. The real audit pipeline will insert a later version
    // report with pdf_path + forensic_audit and status="complete", or mark this row "failed".
    status: "draft",
    patient_audit_version: 2,
    patient_audit_v2: patientAnswers,
  };

  const { error: insErr } = await supabase.from("reports").insert(payload);
  if (!insErr) return;

  if (String(insErr.message || "").includes("patient_audit")) {
    const { error: fallbackErr } = await supabase.from("reports").insert({
      case_id: caseId,
      version: 1,
      summary,
      pdf_path: "",
      status: "draft",
    });
    if (fallbackErr) throw new Error(`Report insert error: ${fallbackErr.message}`);
    return;
  }

  // If version 1 already exists (re-run), update latest instead.
  const { data: existing } = await supabase
    .from("reports")
    .select("id, version")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    const { error: updErr } = await supabase.from("reports").update({ summary }).eq("id", existing.id);
    if (updErr) throw new Error(`Report update error: ${updErr.message}`);
    return;
  }

  throw new Error(`Report insert error: ${insErr.message}`);
}

async function uploadPatientPhoto(supabase: SupabaseClient, caseId: string, userId: string, category: PatientPhotoCategory, filePath: string) {
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const fileName = safeName(path.basename(filePath));
  const stamp = Date.now();
  const storagePath = `cases/${caseId}/patient/${category}/${stamp}-${fileName}`;

  const buffer = await fsp.readFile(filePath);
  const contentType = (() => {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    return "image/jpeg";
  })();

  const up = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);

  const { error: insErr } = await supabase.from("uploads").insert({
    case_id: caseId,
    user_id: userId,
    type: `patient_photo:${category}`,
    storage_path: storagePath,
    metadata: {
      category,
      original_name: fileName,
      mime: contentType,
      size: buffer.length,
      test_audit: true,
    },
  });
  if (insErr) throw new Error(`uploads insert failed: ${insErr.message}`);

  return storagePath;
}

async function markCaseSubmitted(supabase: SupabaseClient, caseId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cases")
    .update({ status: "submitted", submitted_at: now })
    .eq("id", caseId);
  if (error) throw new Error(`Case submit update failed: ${error.message}`);
}

async function triggerAudit(caseId: string, userId: string) {
  if (!process.env.INNGEST_EVENT_KEY) {
    throw new Error("Missing env: INNGEST_EVENT_KEY (required to trigger audit).");
  }
  await inngest.send({ name: "case/submitted", data: { caseId, userId } });
}

async function pollForCompletion(supabase: SupabaseClient, caseId: string, timeoutMs: number) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    const { data: c, error } = await supabase
      .from("cases")
      .select("id, status, created_at")
      .eq("id", caseId)
      .maybeSingle();

    if (error) throw new Error(`Polling cases failed: ${error.message}`);
    const status = String((c as any)?.status ?? "");

    const { data: report, error: repErr } = await supabase
      .from("reports")
      .select("id, version, pdf_path, status, error, summary, created_at")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (repErr) throw new Error(`Polling reports failed: ${repErr.message}`);

    // Prefer explicit case status when available, but don't hang if only report is updated.
    const reportStatus = String((report as any)?.status ?? "");
    const pdfPath = String((report as any)?.pdf_path ?? "");
    const forensic = (report as any)?.summary?.forensic_audit ?? null;
    const hasAuditArtifacts = Boolean((pdfPath && pdfPath !== "null") || forensic);
    const doneByReport =
      reportStatus === "failed" ||
      (reportStatus === "complete" && hasAuditArtifacts);

    if (status === "complete" || status === "audit_failed" || doneByReport) {
      const finalStatus =
        status === "complete"
          ? "complete"
          : status === "audit_failed"
            ? "audit_failed"
            : reportStatus === "complete"
              ? "complete"
              : "audit_failed";
      return { caseRow: c as any, reportRow: report as any, finalStatus };
    }

    const wait = Math.min(15000, 1500 + attempt * 750);
    await sleep(wait);
  }
  throw new Error(`Timed out waiting for audit completion after ${Math.round(timeoutMs / 1000)}s`);
}

async function downloadPdfIfAny(supabase: SupabaseClient, pdfPath: string, outFile: string) {
  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const { data, error } = await supabase.storage.from(bucket).download(pdfPath);
  if (error || !data) throw new Error(`PDF download failed: ${error?.message ?? "no data"}`);
  const buf = Buffer.from(await data.arrayBuffer());
  await fsp.writeFile(outFile, buf);
}

async function runOneCase(
  idx: number,
  allImages: string[],
  opts: CliOptions,
  supabase: SupabaseClient
): Promise<RunOutcome> {
  const gen = generateRandomPatientAnswers();
  const outputDir = path.resolve(__dirname, "output", "test-audits");

  const created = opts.dryRun ? null : await createTestPatientAndCase(supabase);
  const caseId = opts.dryRun ? `dryrun-${idx + 1}-${Date.now()}` : created!.case.caseId;
  const userId = opts.dryRun ? "dry-run" : created!.patient.userId;
  const email = opts.dryRun ? null : created!.patient.email;
  const caseOutDir = path.join(outputDir, caseId);
  await ensureDirs(caseOutDir);

  const chosen = chooseImageSet(allImages);

  const metadata = {
    caseId,
    dryRun: opts.dryRun,
    generated_at: new Date().toISOString(),
    patient: {
      age: gen.age,
      sex_assigned_at_birth: gen.sexAssignedAtBirth,
      smoking: gen.smoking,
    },
    clinic: {
      country: gen.displayCountry,
      procedure_type: gen.procedureTypeDisplay,
      claimed_grafts: gen.claimedGrafts,
      months_since: gen.monthsSince,
    },
    test_identity: opts.dryRun ? null : { user_id: userId, email },
    images: chosen.map((c) => ({
      filePath: c.filePath,
      upload_category: c.uploadCategory,
      filename_tag: c.filename_tag,
      forced_required: Boolean((c as any).forced_required),
    })),
    patient_answers: gen.patientAnswers,
  };

  await writeJson(path.join(caseOutDir, "metadata.json"), metadata);

  if (opts.dryRun) {
    await writeJson(path.join(caseOutDir, "result.json"), {
      ok: true,
      dryRun: true,
      note: "Dry-run: no uploads, no audit trigger.",
    });
    return {
      ok: true,
      caseId,
      country: gen.displayCountry,
      procedureType: gen.procedureTypeDisplay,
      claimedGrafts: gen.claimedGrafts,
      overallScore: null,
      confidence: null,
      createdAt: null,
      pdfPath: null,
      outputDir: caseOutDir,
    };
  }

  const createdAt = (await supabase.from("cases").select("created_at").eq("id", caseId).maybeSingle()).data?.created_at ?? null;

  // Insert draft answers (so Inngest runAudit can pick them up).
  await upsertDraftAnswers(supabase, caseId, gen.patientAnswers as unknown as Record<string, unknown>);

  // Upload images using the same storage paths + uploads rows as the app's patient upload route.
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i]!;
    await uploadPatientPhoto(supabase, caseId, userId, c.uploadCategory, c.filePath);
  }

  await markCaseSubmitted(supabase, caseId);
  await triggerAudit(caseId, userId);

  // Poll for completion.
  const polled = await pollForCompletion(supabase, caseId, 20 * 60 * 1000);
  const report = polled.reportRow as any;

  const pdfPath = (report?.pdf_path as string | undefined) ?? null;
  let pdfLocal: string | null = null;
  if (pdfPath) {
    const outPdf = path.join(caseOutDir, "report.pdf");
    await downloadPdfIfAny(supabase, pdfPath, outPdf);
    pdfLocal = outPdf;
  }

  const summary = (report?.summary ?? {}) as any;
  const forensic = (summary?.forensic_audit ?? null) as any;

  const overallScore =
    (typeof forensic?.overall_score === "number" ? forensic.overall_score : null) ??
    (typeof summary?.overall_score === "number" ? summary.overall_score : null) ??
    (typeof summary?.score === "number" ? summary.score : null);

  const confidence =
    typeof forensic?.confidence === "number"
      ? forensic.confidence
      : typeof summary?.confidence === "number"
        ? summary.confidence
        : null;

  const resultObj = {
    ok: polled.finalStatus === "complete",
    case: polled.caseRow,
    report,
    derived: {
      overall_score: overallScore,
      confidence,
      pdf_path: pdfPath,
      pdf_local_path: pdfLocal,
    },
  };
  await writeJson(path.join(caseOutDir, "result.json"), resultObj);

  if (polled.finalStatus !== "complete") {
    return {
      ok: false,
      caseId,
      country: gen.displayCountry,
      procedureType: gen.procedureTypeDisplay,
      claimedGrafts: gen.claimedGrafts,
      outputDir: caseOutDir,
      error: `Audit status: ${polled.finalStatus} (report status=${String(report?.status ?? "")}, error=${String(report?.error ?? "")})`,
    };
  }

  return {
    ok: true,
    caseId,
    country: gen.displayCountry,
    procedureType: gen.procedureTypeDisplay,
    claimedGrafts: gen.claimedGrafts,
    overallScore,
    confidence,
    createdAt: createdAt ? String(createdAt) : ((polled.caseRow as any)?.created_at ?? null),
    pdfPath: pdfLocal,
    outputDir: caseOutDir,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runOne() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(runners);
  return results;
}

async function main() {
  loadEnvLocal();
  assertSafetyOrExit();

  const opts = parseArgs();
  const supabase = supabaseAdmin();

  if (opts.cleanup) {
    const res = await cleanupTestCases(supabase);
    console.log(`Cleanup complete: deletedCases=${res.deletedCases}, deletedUsers=${res.deletedUsers}`);
    return;
  }

  if (!fs.existsSync(opts.folder)) {
    console.error(`Folder not found: ${opts.folder}`);
    process.exit(1);
  }

  console.log(`Discovering images under: ${opts.folder}`);
  const allImages = await walkImages(opts.folder);
  if (allImages.length === 0) {
    console.error("No images found. Supported: .jpg .jpeg .png .webp");
    process.exit(1);
  }
  console.log(`Found ${allImages.length} image(s). Creating ${opts.n} test case(s).`);

  const outputRoot = path.resolve(__dirname, "output", "test-audits");
  await ensureDirs(outputRoot);

  if (!opts.dryRun && !process.env.INNGEST_EVENT_KEY) {
    console.error("Missing env: INNGEST_EVENT_KEY (required unless --dry-run).");
    process.exit(1);
  }

  const items = Array.from({ length: opts.n }, (_, i) => i);
  let done = 0;
  let okCount = 0;
  let failCount = 0;

  const outcomes = await runWithConcurrency(items, opts.concurrency, async (_i, idx) => {
    const start = Date.now();
    console.log(`[${idx + 1}/${opts.n}] Starting case...`);
    try {
      const res = await runOneCase(idx, allImages, opts, supabase);
      done++;
      if (res.ok) okCount++;
      else failCount++;
      console.log(
        `[${idx + 1}/${opts.n}] ${res.ok ? "OK" : "FAIL"} caseId=${res.caseId} (${Math.round((Date.now() - start) / 1000)}s)`
      );
      if (!res.ok) console.log(`  Error: ${res.error}`);
      return res;
    } catch (e: any) {
      done++;
      failCount++;
      const errMsg = String(e?.message ?? e);
      console.log(`[${idx + 1}/${opts.n}] FAIL (exception) (${Math.round((Date.now() - start) / 1000)}s)`);
      console.log(`  Error: ${errMsg}`);

      // Best-effort: write an error artifact (caseId may not exist).
      const caseId = `error-${idx + 1}-${Date.now()}`;
      const caseOutDir = path.join(outputRoot, caseId);
      await ensureDirs(caseOutDir);
      await writeJson(path.join(caseOutDir, "result.json"), { ok: false, error: errMsg });
      return {
        ok: false,
        caseId,
        country: "",
        procedureType: "",
        claimedGrafts: 0,
        outputDir: caseOutDir,
        error: errMsg,
      } satisfies RunOutcome;
    } finally {
      if (done % 3 === 0 || done === opts.n) {
        console.log(`Progress: ${done}/${opts.n} done (ok=${okCount}, fail=${failCount})`);
      }
    }
  });

  // Write summary CSV
  const csvPath = path.join(outputRoot, "summary.csv");
  const header = [
    "case_id",
    "country",
    "procedure_type",
    "claimed_grafts",
    "overall_score",
    "confidence",
    "created_at",
    "pdf_path",
  ];
  const lines = [header.join(",")];
  for (const o of outcomes) {
    if (o.ok) {
      lines.push(
        [
          o.caseId,
          o.country,
          o.procedureType,
          o.claimedGrafts,
          o.overallScore ?? "",
          o.confidence ?? "",
          o.createdAt ?? "",
          o.pdfPath ?? "",
        ].map(toCsvValue).join(",")
      );
    } else {
      lines.push([o.caseId, o.country, o.procedureType, o.claimedGrafts, "", "", "", ""].map(toCsvValue).join(","));
    }
  }
  await fsp.writeFile(csvPath, lines.join("\n"), "utf8");

  const okOutcomes = outcomes.filter((o): o is Extract<RunOutcome, { ok: true }> => o.ok);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const avgScore = avg(okOutcomes.map((o) => (typeof o.overallScore === "number" ? o.overallScore : 0)).filter((n) => n > 0));
  const avgConf = avg(okOutcomes.map((o) => (typeof o.confidence === "number" ? o.confidence : 0)).filter((n) => n > 0));

  console.log("Done.");
  console.log(`Summary: ok=${okCount}, fail=${failCount}`);
  console.log(`Avg score (ok only): ${avgScore ? avgScore.toFixed(1) : "n/a"}`);
  console.log(`Avg confidence (ok only): ${avgConf ? avgConf.toFixed(3) : "n/a"}`);
  console.log(`Wrote: ${csvPath}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

