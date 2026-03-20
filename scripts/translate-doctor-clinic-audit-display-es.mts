/**
 * Builds Spanish flat doctor/clinic audit display strings via MyMemory public API.
 * Run: pnpm exec tsx scripts/translate-doctor-clinic-audit-display-es.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VARIANTS = [
  {
    src: `${ROOT}/src/lib/i18n/translations/_generated/doctorCaseAudit.flat.en.json`,
    out: `${ROOT}/src/lib/i18n/translations/_generated/doctorCaseAudit.flat.es.json`,
  },
  {
    src: `${ROOT}/src/lib/i18n/translations/_generated/clinicCaseAudit.flat.en.json`,
    out: `${ROOT}/src/lib/i18n/translations/_generated/clinicCaseAudit.flat.es.json`,
  },
] as const;

async function translateText(text: string): Promise<string> {
  const maxLen = 450;
  const chunk = text.length > maxLen ? text.slice(0, maxLen) : text;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|es`;
  try {
    const res = await fetch(url);
    if (!res.ok) return text;
    const j = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
    const out = j.responseData?.translatedText;
    if (!out || j.responseStatus === 403 || out === chunk) return text;
    return out;
  } catch {
    return text;
  }
}

const allFlats = VARIANTS.map(({ src }) => JSON.parse(readFileSync(src, "utf8")) as Record<string, string>);
const unique = [...new Set(allFlats.flatMap((flat) => Object.values(flat)))];
const cache = new Map<string, string>();

let i = 0;
for (const en of unique) {
  const es = await translateText(en);
  cache.set(en, es);
  i += 1;
  if (i % 25 === 0) console.error(`Translated ${i}/${unique.length}…`);
  await delay(200);
}

for (const { src, out } of VARIANTS) {
  const flat = JSON.parse(readFileSync(src, "utf8")) as Record<string, string>;
  const translated: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) translated[k] = cache.get(v) ?? v;
  writeFileSync(out, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
  console.error(`Wrote ${out} (${Object.keys(translated).length} keys)`);
}
