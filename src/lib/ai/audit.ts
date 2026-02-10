// src/lib/ai/audit.ts
// AI-powered hair transplant audit using GPT-4 Vision (images) + GPT-4 (text answers)
// Falls back to text-only if no vision capability or images unavailable.

import OpenAI from "openai";

export type AIAuditInput = {
  patient_answers?: Record<string, unknown> | null;
  doctor_answers?: Record<string, unknown> | null;
  clinic_answers?: Record<string, unknown> | null;
  /** Publicly fetchable image URLs (e.g. Supabase signed URLs) for vision analysis */
  imageUrls?: string[];
};

export type AIAuditResult = {
  score: number;
  donor_quality: string;
  graft_survival_estimate: string;
  notes: string;
  findings: string[];
  /** Model used for audit (for transparency) */
  model: string;
};

function formatAnswersForPrompt(answers: Record<string, unknown> | null | undefined): string {
  if (!answers || typeof answers !== "object") return "(none provided)";
  const lines: string[] = [];
  for (const [key, val] of Object.entries(answers)) {
    if (val === null || val === undefined) continue;
    const v = Array.isArray(val) ? val.join(", ") : String(val);
    if (v.trim()) lines.push(`  - ${key}: ${v}`);
  }
  return lines.length ? lines.join("\n") : "(none provided)";
}

/** Run AI audit on answers + optionally images. Returns structured audit result. */
export async function runAIAudit(input: AIAuditInput): Promise<AIAuditResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      score: 0,
      donor_quality: "—",
      graft_survival_estimate: "—",
      notes: "AI audit skipped: OPENAI_API_KEY not configured.",
      findings: [],
      model: "none",
    };
  }

  const client = new OpenAI({ apiKey });

  const patientBlock = formatAnswersForPrompt(input.patient_answers);
  const doctorBlock = formatAnswersForPrompt(input.doctor_answers);
  const clinicBlock = formatAnswersForPrompt(input.clinic_answers);

  const systemPrompt = `You are an expert hair transplant auditor. Analyze the patient, doctor, and clinic survey answers, and when images are provided, also analyze the pre-op, donor, intra-op, and post-op photos to produce a structured audit.

Output a JSON object with exactly these keys:
- score: number 0-100 (overall quality)
- donor_quality: string (e.g. "Excellent", "Good", "Fair", "Poor", "Cannot assess")
- graft_survival_estimate: string (e.g. "85-95%", "70-85%", "Unknown")
- notes: string (2-4 sentences summarizing the case)
- findings: string[] (3-8 bullet points of key observations, risks, or recommendations)

Be objective and evidence-based. If data is insufficient, say so. Never provide medical advice; this is an audit, not a diagnosis.`;

  const userContent: (OpenAI.Chat.Completions.ChatCompletionContentPart)[] = [
    {
      type: "text",
      text: `## Patient answers\n${patientBlock}\n\n## Doctor answers\n${doctorBlock}\n\n## Clinic answers\n${clinicBlock}\n\nProvide a structured audit as JSON.`,
    },
  ];

  // Add images if available (use vision model)
  const imageUrls = (input.imageUrls ?? []).filter(Boolean).slice(0, 10);
  if (imageUrls.length > 0) {
    userContent.push({
      type: "text",
      text: "\n## Photos to analyze\nBelow are images of the patient's scalp (pre-op, donor area, intra-op, post-op as available). Analyze them for donor density, hairline design, graft placement, and overall quality. Incorporate your image analysis into the audit.",
    });
    for (const url of imageUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url },
      });
    }
  }

  const model = imageUrls.length > 0 ? "gpt-4o" : "gpt-4o-mini";

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const score = Math.min(100, Math.max(0, Number(parsed.score) ?? 0));
    const donor_quality = String(parsed.donor_quality ?? "—").slice(0, 80);
    const graft_survival_estimate = String(parsed.graft_survival_estimate ?? "—").slice(0, 80);
    const notes = String(parsed.notes ?? "").slice(0, 1000);
    const findings = Array.isArray(parsed.findings)
      ? (parsed.findings as string[]).map((f) => String(f).slice(0, 300))
      : [];

    return {
      score,
      donor_quality,
      graft_survival_estimate,
      notes,
      findings,
      model,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      score: 0,
      donor_quality: "—",
      graft_survival_estimate: "—",
      notes: `AI audit failed: ${msg}`,
      findings: [],
      model: "error",
    };
  }
}
