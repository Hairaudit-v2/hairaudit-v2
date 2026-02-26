import OpenAI from "openai";

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

export async function runGraftIntegrityModelEstimate(input: {
  claimed_grafts: number | null;
  donor: Array<{ key: string; signedUrl: string }>;
  recipient: Array<{ key: string; signedUrl: string }>;
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
  const model = "gpt-5.2";

  const metadataLines = Object.entries(input.metadata ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const systemPrompt =
    "You are a visual-density estimation engine. You output probabilistic ranges, not exact counts. Use conservative assumptions. If evidence insufficient, widen ranges and lower confidence.\n\n" +
    "Strict constraints:\n" +
    "- Never accuse clinics or attribute intent.\n" +
    "- Do not present a definitive graft count.\n" +
    "- If donor/recipient views are unclear, state limitations and add flags.\n" +
    "- Output must strictly match the provided JSON Schema (no extra keys).";

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
      userParts.push({ type: "text", text: `donor_image_key: ${d.key}` });
      userParts.push({ type: "image_url", image_url: { url: d.signedUrl } });
    }
  } else {
    userParts.push({ type: "text", text: "\n## Donor images\n(none provided)" });
  }

  if (input.recipient.length > 0) {
    userParts.push({ type: "text", text: "\n## Recipient images (keys are storage paths)" });
    for (const r of input.recipient.slice(0, 10)) {
      userParts.push({ type: "text", text: `recipient_image_key: ${r.key}` });
      userParts.push({ type: "image_url", image_url: { url: r.signedUrl } });
    }
  } else {
    userParts.push({ type: "text", text: "\n## Recipient images\n(none provided)" });
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userParts },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response_format: { type: "json_schema", json_schema: GRAFT_INTEGRITY_JSON_SCHEMA } as any,
    temperature: 0.2,
    max_tokens: 1900,
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

  const confidence = clamp(Number(parsed.confidence), 0.45, 0.95);
  const confidence_label = labelFromConfidence(confidence);

  const inputs_used: GraftIntegrityInputs = {
    donor_images: uniq(Array.isArray(parsed.inputs_used?.donor_images) ? parsed.inputs_used.donor_images : []),
    recipient_images: uniq(Array.isArray(parsed.inputs_used?.recipient_images) ? parsed.inputs_used.recipient_images : []),
    metadata_keys: uniq(Array.isArray(parsed.inputs_used?.metadata_keys) ? parsed.inputs_used.metadata_keys : []),
  };

  const limitations = uniq(Array.isArray(parsed.limitations) ? parsed.limitations.map(String) : []);
  const flags = uniq(Array.isArray(parsed.flags) ? parsed.flags.map(String) : []);

  const variance = {
    claimed_vs_extracted_pct: {
      min: normNumOrNull(parsed.variance?.claimed_vs_extracted_pct?.min),
      max: normNumOrNull(parsed.variance?.claimed_vs_extracted_pct?.max),
    },
    claimed_vs_implanted_pct: {
      min: normNumOrNull(parsed.variance?.claimed_vs_implanted_pct?.min),
      max: normNumOrNull(parsed.variance?.claimed_vs_implanted_pct?.max),
    },
  };

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
    flags,
    ai_notes: ai_notes.length ? ai_notes : "A probabilistic graft-range estimate was generated with conservative assumptions and explicit limitations.",
  };
}

