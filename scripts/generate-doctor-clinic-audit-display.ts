/**
 * Regenerates dashboard.{doctor,clinic}.forms.caseAudit display trees from canonical form schemas.
 * Run: pnpm exec tsx scripts/generate-doctor-clinic-audit-display.ts
 *
 * Writes:
 * - src/lib/i18n/translations/_generated/doctorCaseAudit.en.json
 * - src/lib/i18n/translations/_generated/doctorCaseAudit.flat.en.json
 * - src/lib/i18n/translations/_generated/clinicCaseAudit.en.json
 * - src/lib/i18n/translations/_generated/clinicCaseAudit.flat.en.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCTOR_AUDIT_SECTIONS } from "../src/lib/doctorAuditForm";
import { CLINIC_AUDIT_SECTIONS } from "../src/lib/clinicAuditForm";

type QuestionLike = {
  id: string;
  prompt: string;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type SectionLike = {
  id: string;
  title: string;
  questions: QuestionLike[];
};

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

function flatten(pathPrefix: string, node: unknown, out: Record<string, string>) {
  if (node == null || typeof node !== "object" || Array.isArray(node)) return;
  const rec = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    const next = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      flatten(next, v, out);
    } else if (typeof v === "string") {
      out[next] = v;
    }
  }
}

function buildDisplayTree(sections: SectionLike[]) {
  const fields: Record<string, unknown> = {};
  const outSections: Record<string, { title: string }> = {};

  for (const section of sections) {
    outSections[section.id] = { title: section.title };
    for (const q of section.questions) {
      const leaf: Record<string, unknown> = { prompt: q.prompt };
      if (q.help) leaf.help = q.help;
      if (q.placeholder) leaf.placeholder = q.placeholder;
      if (q.options?.length) {
        const opts: Record<string, string> = {};
        for (const o of q.options) opts[o.value] = o.label;
        leaf.options = opts;
      }
      setNestedMerge(fields, q.id.split("."), leaf);
    }
  }

  return { sections: outSections, fields };
}

function writeVariant(name: string, sections: SectionLike[]) {
  const tree = buildDisplayTree(sections);
  const nestedPath = join(OUT_DIR, `${name}.en.json`);
  const flatPath = join(OUT_DIR, `${name}.flat.en.json`);
  const flat: Record<string, string> = {};
  flatten("", tree, flat);
  writeFileSync(nestedPath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  writeFileSync(flatPath, `${JSON.stringify(flat, null, 2)}\n`, "utf8");
  console.log(`Wrote ${nestedPath} (${Object.keys(flat).length} leaf strings)`);
  console.log(`Wrote ${flatPath}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeVariant("doctorCaseAudit", DOCTOR_AUDIT_SECTIONS);
writeVariant("clinicCaseAudit", CLINIC_AUDIT_SECTIONS);
