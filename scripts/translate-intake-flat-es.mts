/**
 * Build Spanish flat intake strings via MyMemory public API (no API key).
 * Run: pnpm tsx scripts/translate-intake-flat-es.mts
 *
 * Writes: src/lib/i18n/translations/_generated/intakeFields.flat.es.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const FLAT_EN_PATH = fileURLToPath(new URL("../src/lib/i18n/translations/_generated/intakeFields.flat.en.json", import.meta.url));
const OUT_PATH = fileURLToPath(new URL("../src/lib/i18n/translations/_generated/intakeFields.flat.es.json", import.meta.url));

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

const flat = JSON.parse(readFileSync(FLAT_EN_PATH, "utf8")) as Record<string, string>;
const unique = [...new Set(Object.values(flat))];
const cache = new Map<string, string>();

let i = 0;
for (const en of unique) {
  const es = await translateText(en);
  cache.set(en, es);
  i += 1;
  if (i % 25 === 0) console.error(`Translated ${i}/${unique.length}…`);
  await delay(350);
}

const out: Record<string, string> = {};
for (const [k, v] of Object.entries(flat)) {
  out[k] = cache.get(v) ?? v;
}

writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.error(`Wrote ${OUT_PATH} (${Object.keys(out).length} keys)`);
