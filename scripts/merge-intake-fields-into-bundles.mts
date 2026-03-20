/**
 * Merges generated intake field trees into locale bundles.
 * - EN: copies src/lib/i18n/translations/_generated/intakeFields.en.json → en.json dashboard.patient.forms.intakeFields
 * - ES: unflattens _generated/intakeFields.flat.es.json (handles .options.* with spaces in option keys)
 *
 * Run: pnpm exec tsx scripts/merge-intake-fields-into-bundles.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EN_BUNDLE = `${ROOT}/src/lib/i18n/translations/en.json`;
const ES_BUNDLE = `${ROOT}/src/lib/i18n/translations/es.json`;
const INTAKE_EN = `${ROOT}/src/lib/i18n/translations/_generated/intakeFields.en.json`;
const INTAKE_FLAT_ES = `${ROOT}/src/lib/i18n/translations/_generated/intakeFields.flat.es.json`;
const INTAKE_OUT_ES = `${ROOT}/src/lib/i18n/translations/_generated/intakeFields.es.json`;

type Json = Record<string, unknown>;

function deepMergeOptions(target: Json, incoming: Json) {
  for (const [k, v] of Object.entries(incoming)) {
    if (k === "options" && v && typeof v === "object" && !Array.isArray(v)) {
      const prevOpt = target.options;
      if (prevOpt && typeof prevOpt === "object" && !Array.isArray(prevOpt)) {
        Object.assign(prevOpt as Json, v as Json);
      } else {
        target.options = { ...(v as Json) };
      }
      continue;
    }
    target[k] = v;
  }
}

function setNestedMerge(root: Json, parts: string[], leaf: Json) {
  let cur: Json = root;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      const prev = cur[p];
      if (prev && typeof prev === "object" && !Array.isArray(prev)) {
        deepMergeOptions(prev as Json, leaf);
      } else {
        cur[p] = { ...leaf };
      }
    } else {
      if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) {
        cur[p] = {};
      }
      cur = cur[p] as Json;
    }
  }
}

function unflattenIntakeFlatEs(flat: Record<string, string>): Json {
  const intakeFields: Json = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const optSep = ".options.";
    const optIdx = flatKey.indexOf(optSep);
    if (optIdx !== -1) {
      const base = flatKey.slice(0, optIdx);
      const optKey = flatKey.slice(optIdx + optSep.length);
      setNestedMerge(intakeFields, base.split("."), { options: { [optKey]: value } });
      continue;
    }
    const lastDot = flatKey.lastIndexOf(".");
    if (lastDot <= 0) continue;
    const base = flatKey.slice(0, lastDot);
    const leafKey = flatKey.slice(lastDot + 1);
    if (leafKey !== "prompt" && leafKey !== "help" && leafKey !== "placeholder") {
      console.warn("unexpected flat key suffix:", flatKey);
      continue;
    }
    setNestedMerge(intakeFields, base.split("."), { [leafKey]: value });
  }
  return intakeFields;
}

const enBundle = JSON.parse(readFileSync(EN_BUNDLE, "utf8")) as Json;
const esBundle = JSON.parse(readFileSync(ES_BUNDLE, "utf8")) as Json;
const intakeEn = JSON.parse(readFileSync(INTAKE_EN, "utf8")) as Json;
const flatEs = JSON.parse(readFileSync(INTAKE_FLAT_ES, "utf8")) as Record<string, string>;

const intakeEs = unflattenIntakeFlatEs(flatEs);
writeFileSync(INTAKE_OUT_ES, `${JSON.stringify(intakeEs, null, 2)}\n`, "utf8");

const enDash = enBundle.dashboard as Json;
const enPatient = enDash.patient as Json;
const enForms = enPatient.forms as Json;
enForms.intakeFields = intakeEn;

const esDash = esBundle.dashboard as Json;
const esPatient = esDash.patient as Json;
const esForms = esPatient.forms as Json;
esForms.intakeFields = intakeEs;

writeFileSync(EN_BUNDLE, `${JSON.stringify(enBundle, null, 2)}\n`, "utf8");
writeFileSync(ES_BUNDLE, `${JSON.stringify(esBundle, null, 2)}\n`, "utf8");

console.error(
  `Merged intakeFields: EN top-level keys=${Object.keys(intakeEn).length}; ES nested write: ${INTAKE_OUT_ES}`,
);
