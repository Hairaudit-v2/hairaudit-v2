/**
 * Regenerates dashboard.patient.forms.intakeFields trees from PATIENT_AUDIT_SECTIONS.
 * Run: pnpm tsx scripts/generate-patient-intake-intakeFields.ts
 *
 * Writes:
 * - src/lib/i18n/translations/_generated/intakeFields.en.json
 * - src/lib/i18n/translations/_generated/intakeFields.flat.en.json (debug / translator aid)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PATIENT_AUDIT_SECTIONS } from "../src/lib/patientAuditForm";

/** Option labels come from `dashboard.patient.forms.reviewEnums.<id>.*` — omit duplicate `options` in intakeFields. */
const REVIEW_ENUM_QUESTION_IDS = new Set([
  "clinic_country",
  "procedure_type",
  "donor_shaving",
  "surgery_duration",
  "post_op_swelling",
  "bleeding_issue",
  "recovery_time",
  "shock_loss",
  "months_since",
  "would_repeat",
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../src/lib/i18n/translations/_generated");

function deepMergeOptions(target: Record<string, unknown>, incoming: Record<string, unknown>) {
  for (const [k, v] of Object.entries(incoming)) {
    if (k === "options" && v && typeof v === "object" && !Array.isArray(v)) {
      const prevOpt = target.options;
      if (prevOpt && typeof prevOpt === "object" && !Array.isArray(prevOpt)) {
        Object.assign(prevOpt as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        target.options = { ...(v as Record<string, unknown>) };
      }
      continue;
    }
    target[k] = v;
  }
}

function setNestedMerge(root: Record<string, unknown>, parts: string[], leaf: Record<string, unknown>) {
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      const prev = cur[p];
      if (prev && typeof prev === "object" && !Array.isArray(prev)) {
        deepMergeOptions(prev as Record<string, unknown>, leaf);
      } else {
        cur[p] = { ...leaf };
      }
    } else {
      if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) {
        cur[p] = {};
      }
      cur = cur[p] as Record<string, unknown>;
    }
  }
}

function flattenIntake(pathPrefix: string, node: unknown, out: Record<string, string>) {
  if (node == null || typeof node !== "object" || Array.isArray(node)) return;
  const rec = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    const next = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      flattenIntake(next, v, out);
    } else if (typeof v === "string") {
      out[next] = v;
    }
  }
}

const intakeFields: Record<string, unknown> = {};

for (const sec of PATIENT_AUDIT_SECTIONS) {
  for (const q of sec.questions) {
    const parts = q.id.split(".");
    const leaf: Record<string, unknown> = { prompt: q.prompt };
    if (q.help) leaf.help = q.help;
    if (q.placeholder) leaf.placeholder = q.placeholder;
    if (q.options?.length && !REVIEW_ENUM_QUESTION_IDS.has(q.id)) {
      const opts: Record<string, string> = {};
      for (const o of q.options) opts[o.value] = o.label;
      leaf.options = opts;
    }
    setNestedMerge(intakeFields, parts, leaf);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const enPath = join(OUT_DIR, "intakeFields.en.json");
writeFileSync(enPath, `${JSON.stringify(intakeFields, null, 2)}\n`, "utf8");

const flat: Record<string, string> = {};
flattenIntake("", intakeFields, flat);
const flatPath = join(OUT_DIR, "intakeFields.flat.en.json");
writeFileSync(flatPath, `${JSON.stringify(flat, null, 2)}\n`, "utf8");

console.log(`Wrote ${enPath} (${Object.keys(flat).length} leaf strings)`);
console.log(`Wrote ${flatPath}`);
