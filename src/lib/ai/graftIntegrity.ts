import OpenAI from "openai";
import { maxTokensParam } from "@/lib/ai/openaiTokenCompat";

export const GRAFT_INTEGRITY_SYSTEM_PROMPT = `You are GPT-5.2 acting as the Graft Integrity Estimator for HairAudit / Follicle Intelligence.

MISSION
Estimate (probabilistically) how the visually supported graft counts compare to the claimed graft count using available donor/recipient images and case metadata. You MUST output conservative ranges (min/max), not exact counts.

IMPORTANT POSITIONING (LEGAL + SAFETY)

You are not a medical provider. You do not diagnose, prescribe, or provide treatment advice.

You do not accuse any clinic/doctor of wrongdoing. Do NOT use terms like: fraud, scam, dishonest, malpractice, negligence, lying.

You do not state facts you cannot verify. All outputs are estimates based on submitted evidence.

If evidence is insufficient, you widen ranges and lower confidence; you do NOT “force” a precise estimate.

WHAT YOU ARE ESTIMATING (CONCEPTUAL)
You may estimate:

Estimated extracted graft range: based on donor extraction zone appearance (day 0 donor, donor rear/sides), visible extraction point density patterns, and approximate extraction area.

Estimated implanted graft range: based on recipient implantation zone appearance (day 0 recipient, intra-op recipient), visible incision/site density patterns, and approximate implantation area.

Variance vs claimed: compare claimed count against estimated ranges as a percentage range.

You may infer uncertainty from:

lighting, focus, angle, hair length/shaving, occlusion, image resolution

inability to confidently classify photo view (donor vs recipient, day 0 vs healed, etc.)

lack of intra-op images

mismatch between described zones vs what is visible

YOU MUST BE CONSERVATIVE

Prefer broader ranges over narrow ones unless evidence is strong.

Default to conservative assumptions when the extraction/implantation area cannot be measured reliably.

Never output confidence below 0.45. Never output 0%.

If you cannot estimate one side (extracted or implanted), set that min/max to null and explain in limitations.

EVIDENCE HANDLING
You will receive:

claimed graft count (may be null)

images (0+): donor/recipient views at various times

optional metadata (procedure type, shaving, surgery duration, zones transplanted)

You MUST:
A) Classify which images are useful for donor estimation and which for recipient estimation.
B) Explicitly track inputs you used (lists of image identifiers/urls or indexes) and metadata keys used.
C) List limitations and reasons for uncertainty.

DO NOT OVER-INTERPRET

You cannot directly observe transection. You may only indicate that discrepancies could be consistent with multiple explanations (documentation differences, counting methods, visibility, handling, survival variability, etc.).

You cannot confirm exact graft counts from photos. You can only provide a plausible estimated range.

ESTIMATION MENTAL MODEL (HIGH-LEVEL)
When evidence allows, approximate:

extraction/implantation area (relative region size; do not invent exact cm² if not supported)

density of visible sites (low/medium/high; if clear, approximate plausible densities)
Then translate into a range.
If area or density cannot be reasonably approximated, widen range substantially or return null.

CONFIDENCE
Compute a confidence value (0.45–0.95) driven by:

number of relevant images (donor and recipient)

clarity (sharpness/lighting)

view completeness (rear + sides donor; frontal/top recipient; day 0 clarity)

consistency between multiple images

presence of intra-op images and/or shaved donor day 0
Higher completeness → higher confidence.
Low completeness → lower confidence and wider ranges.

FLAGS (NON-ACCUSATORY)
You may output flags like:

"insufficient_donor_photos"

"insufficient_recipient_photos"

"inconsistent_view_classification"

"low_image_quality"

"no_day0_images"

"large_variance"
But “large_variance” must mean:
estimated ranges differ materially from claimed (e.g., >25% discrepancy) AND confidence is medium/high.

OUTPUT REQUIREMENTS (STRICT)
You MUST output ONLY a single JSON object that conforms exactly to the provided JSON schema.
No markdown, no extra commentary, no additional keys.

TEXT TONE FOR ai_notes

3–6 sentences maximum.

Neutral, professional, observational.

Must include at least one sentence acknowledging evidence limitations and that this is not a definitive graft count.

Do not mention internal policy or hidden reasoning.

NUMERIC RULES

All percentages are absolute values as percentages (e.g., 0–100), not decimals.

Variance sign convention:

Negative means estimate is lower than claimed.

Positive means estimate is higher than claimed.
If you cannot compute variance, set it to null.

CONSISTENCY CHECKS (MUST)

If claimed_grafts is null, variances must be null.

If estimated_implanted is null, claimed_vs_implanted variance must be null.

If estimated_extracted is null, claimed_vs_extracted variance must be null.

If estimated_implanted_min > estimated_extracted_max, add flag "impossible_implant_gt_extract" and lower confidence.

If any range min > max, fix it before output.

FINAL REMINDER
Be conservative, be defensible, and be neutral. Produce ranges with confidence and limitations based strictly on the evidence provided.
`;

export type GraftIntegrityInputs = {
  donor_images: string[];
  recipient_images: string[];
  metadata_keys: string[];
};

export type AuditorAdjustment = {
  claimed_grafts?: number | null;
  estimated_extracted?: { min: number | null; max: number | null };
  estimated_implanted?: { min: number | null; max: number | null };
  confidence?: number;
  confidence_label?: "low" | "medium" | "high";
  limitations?: string[];
  flags?: string[];
  ai_notes?: string;
};

export type GraftIntegrityEstimate = {
  claimed_grafts: number | null;
  estimated_extracted: { min: number | null; max: number | null };
  estimated_implanted: { min: number | null; max: number | null };
  variance: {
    claimed_vs_extracted_pct: { min: number | null; max: number | null };
    claimed_vs_implanted_pct: { min: number | null; max: number | null };
  };
  confidence: number; // 0.45–0.95
  confidence_label: "low" | "medium" | "high";
  inputs_used: GraftIntegrityInputs;
  limitations: string[];
  flags: string[];
  ai_notes: string;
};

const GRAFT_INTEGRITY_JSON_SCHEMA = {
  name: "graft_integrity_estimate",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      claimed_grafts: { anyOf: [{ type: "number" }, { type: "null" }] },
      estimated_extracted: {
        type: "object",
        additionalProperties: false,
        properties: {
          min: { anyOf: [{ type: "number" }, { type: "null" }] },
          max: { anyOf: [{ type: "number" }, { type: "null" }] },
        },
        required: ["min", "max"],
      },
      estimated_implanted: {
        type: "object",
        additionalProperties: false,
        properties: {
          min: { anyOf: [{ type: "number" }, { type: "null" }] },
          max: { anyOf: [{ type: "number" }, { type: "null" }] },
        },
        required: ["min", "max"],
      },
      variance: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimed_vs_extracted_pct: {
            type: "object",
            additionalProperties: false,
            properties: {
              min: { anyOf: [{ type: "number" }, { type: "null" }] },
              max: { anyOf: [{ type: "number" }, { type: "null" }] },
            },
            required: ["min", "max"],
          },
          claimed_vs_implanted_pct: {
            type: "object",
            additionalProperties: false,
            properties: {
              min: { anyOf: [{ type: "number" }, { type: "null" }] },
              max: { anyOf: [{ type: "number" }, { type: "null" }] },
            },
            required: ["min", "max"],
          },
        },
        required: ["claimed_vs_extracted_pct", "claimed_vs_implanted_pct"],
      },
      confidence: { type: "number", minimum: 0.45, maximum: 0.95 },
      confidence_label: { type: "string", enum: ["low", "medium", "high"] },
      inputs_used: {
        type: "object",
        additionalProperties: false,
        properties: {
          donor_images: { type: "array", items: { type: "string" } },
          recipient_images: { type: "array", items: { type: "string" } },
          metadata_keys: { type: "array", items: { type: "string" } },
        },
        required: ["donor_images", "recipient_images", "metadata_keys"],
      },
      limitations: { type: "array", items: { type: "string" } },
      flags: { type: "array", items: { type: "string" } },
      ai_notes: { type: "string" },
    },
    required: [
      "claimed_grafts",
      "estimated_extracted",
      "estimated_implanted",
      "variance",
      "confidence",
      "confidence_label",
      "inputs_used",
      "limitations",
      "flags",
      "ai_notes",
    ],
  },
} as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function normNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs.map((x) => String(x).trim()).filter(Boolean)));
}

function labelFromConfidence(c: number): "low" | "medium" | "high" {
  return c < 0.55 ? "low" : c < 0.8 ? "medium" : "high";
}

function swapIfOutOfOrder(r: { min: number | null; max: number | null }) {
  if (r.min === null || r.max === null) return r;
  if (r.min <= r.max) return r;
  return { min: r.max, max: r.min };
}

function variancePct(claimed: number | null, est: number | null): number | null {
  if (claimed === null || claimed === undefined) return null;
  if (!Number.isFinite(claimed) || claimed <= 0) return null;
  if (est === null || est === undefined) return null;
  if (!Number.isFinite(est)) return null;
  return ((est - claimed) / claimed) * 100;
}

export async function runGraftIntegrityEstimate(input: {
  claimed_grafts: number | null;
  donor: Array<{ key: string; signedUrl?: string; dataUrl?: string }>;
  recipient: Array<{ key: string; signedUrl?: string; dataUrl?: string }>;
  metadata: Record<string, string>;
}): Promise<GraftIntegrityEstimate> {
  const apiKey = process.env.OPENAI_API_KEY;

  // If AI is disabled, still return a valid, conservative payload.
  if (!apiKey) {
    const donorKeys = input.donor.map((x) => x.key);
    const recipientKeys = input.recipient.map((x) => x.key);
    const mdKeys = Object.keys(input.metadata ?? {});
    const baseConfidence = 0.45;
    return {
      claimed_grafts: input.claimed_grafts,
      estimated_extracted: { min: null, max: null },
      estimated_implanted: { min: null, max: null },
      variance: {
        claimed_vs_extracted_pct: { min: null, max: null },
        claimed_vs_implanted_pct: { min: null, max: null },
      },
      confidence: baseConfidence,
      confidence_label: "low",
      inputs_used: { donor_images: donorKeys, recipient_images: recipientKeys, metadata_keys: mdKeys },
      limitations: ["AI estimate skipped: OPENAI_API_KEY not configured."],
      flags: uniq([
        ...(donorKeys.length ? [] : ["insufficient_donor_photos"]),
        ...(recipientKeys.length ? [] : ["insufficient_recipient_photos"]),
      ]),
      ai_notes:
        "A graft-range estimate was not generated because the AI service is not configured. No conclusions can be drawn from the available evidence in this run. If photos and procedure details are provided, this feature can generate a conservative range with an explicit confidence level and limitations.",
    };
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const metadataLines = Object.entries(input.metadata ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const userParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  userParts.push({
    type: "text",
    text:
      "## Task\n" +
      "Estimate extracted and implanted graft *ranges* that are visually supportable given the images and metadata. Use conservative assumptions.\n\n" +
      `## Claimed grafts (patient-entered)\n${input.claimed_grafts ?? "(not provided)"}\n\n` +
      "## Metadata\n" +
      (metadataLines.length ? metadataLines : "(none provided)") +
      "\n\n" +
      "## Photo groups\n" +
      "- Donor group: images labeled as donor-relevant (rear/side/day0 donor/intraop donor when available)\n" +
      "- Recipient group: images labeled as recipient-relevant (intraop recipient/day0 recipient/early postop)\n\n" +
      "Output requirements:\n" +
      "- Provide extracted + implanted ranges as min/max (null if cannot estimate).\n" +
      "- Provide confidence 0.45–0.95 with label low/medium/high.\n" +
      "- Provide limitations + flags.\n" +
      "- ai_notes must be 3–6 neutral sentences.",
  });

  if (input.donor.length > 0) {
    userParts.push({ type: "text", text: "\n## Donor images (keys are storage paths)" });
    for (const d of input.donor.slice(0, 10)) {
      const imageUrl = d.dataUrl || d.signedUrl;
      if (!imageUrl) continue;
      userParts.push({ type: "text", text: `donor_image_key: ${d.key}` });
      userParts.push({ type: "image_url", image_url: { url: imageUrl } });
    }
  } else {
    userParts.push({ type: "text", text: "\n## Donor images\n(none provided)" });
  }

  if (input.recipient.length > 0) {
    userParts.push({ type: "text", text: "\n## Recipient images (keys are storage paths)" });
    for (const r of input.recipient.slice(0, 10)) {
      const imageUrl = r.dataUrl || r.signedUrl;
      if (!imageUrl) continue;
      userParts.push({ type: "text", text: `recipient_image_key: ${r.key}` });
      userParts.push({ type: "image_url", image_url: { url: imageUrl } });
    }
  } else {
    userParts.push({ type: "text", text: "\n## Recipient images\n(none provided)" });
  }

  const tokenParam = maxTokensParam(model, 2000);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: GRAFT_INTEGRITY_SYSTEM_PROMPT },
      { role: "user", content: userParts },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response_format: { type: "json_schema", json_schema: GRAFT_INTEGRITY_JSON_SCHEMA } as any,
    temperature: 0.2,
    ...(tokenParam as any),
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response");

  const parsed = JSON.parse(raw) as GraftIntegrityEstimate;

  const claimed = normIntOrNull(parsed.claimed_grafts);
  const extracted = swapIfOutOfOrder({
    min: normIntOrNull(parsed.estimated_extracted?.min),
    max: normIntOrNull(parsed.estimated_extracted?.max),
  });
  const implanted = swapIfOutOfOrder({
    min: normIntOrNull(parsed.estimated_implanted?.min),
    max: normIntOrNull(parsed.estimated_implanted?.max),
  });

  let confidence = clamp(Number(parsed.confidence), 0.45, 0.95);
  let confidence_label = labelFromConfidence(confidence);

  const inputs_used: GraftIntegrityInputs = {
    donor_images: uniq(Array.isArray(parsed.inputs_used?.donor_images) ? parsed.inputs_used.donor_images : []),
    recipient_images: uniq(Array.isArray(parsed.inputs_used?.recipient_images) ? parsed.inputs_used.recipient_images : []),
    metadata_keys: uniq(Array.isArray(parsed.inputs_used?.metadata_keys) ? parsed.inputs_used.metadata_keys : []),
  };

  const limitations = uniq(Array.isArray(parsed.limitations) ? parsed.limitations.map(String) : []);
  const flags = uniq(Array.isArray(parsed.flags) ? parsed.flags.map(String) : []);

  // Guard: compute variances server-side to enforce consistency rules.
  const variance = {
    claimed_vs_extracted_pct: {
      min: variancePct(claimed, extracted.min),
      max: variancePct(claimed, extracted.max),
    },
    claimed_vs_implanted_pct: {
      min: variancePct(claimed, implanted.min),
      max: variancePct(claimed, implanted.max),
    },
  };

  // Guard: if claimed is null, variances must be null.
  if (claimed === null) {
    variance.claimed_vs_extracted_pct = { min: null, max: null };
    variance.claimed_vs_implanted_pct = { min: null, max: null };
  }

  // Guard: impossible implanted > extracted; flag + lower confidence.
  if (implanted.min !== null && extracted.max !== null && implanted.min > extracted.max) {
    flags.push("impossible_implant_gt_extract");
    confidence = clamp(confidence - 0.08, 0.45, 0.95);
    confidence_label = labelFromConfidence(confidence);
  }

  // Guard: confidence must never be 0.
  confidence = clamp(confidence || 0.45, 0.45, 0.95);
  confidence_label = labelFromConfidence(confidence);

  const ai_notes = String(parsed.ai_notes ?? "").trim();

  return {
    claimed_grafts: claimed,
    estimated_extracted: extracted,
    estimated_implanted: implanted,
    variance,
    confidence,
    confidence_label,
    inputs_used,
    limitations,
    flags: uniq(flags),
    ai_notes: ai_notes.length ? ai_notes : "A probabilistic graft-range estimate was generated with conservative assumptions and explicit limitations.",
  };
}

// Back-compat name used by the pipeline.
export async function runGraftIntegrityModelEstimate(input: {
  claimed_grafts: number | null;
  donor: Array<{ key: string; signedUrl?: string; dataUrl?: string }>;
  recipient: Array<{ key: string; signedUrl?: string; dataUrl?: string }>;
  metadata: Record<string, string>;
}): Promise<GraftIntegrityEstimate> {
  return runGraftIntegrityEstimate(input);
}

