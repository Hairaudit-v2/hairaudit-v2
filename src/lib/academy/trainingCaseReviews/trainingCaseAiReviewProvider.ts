import OpenAI, { APIError } from "openai";
import { maxTokensParam, supportsChatTemperature } from "@/lib/ai/openaiTokenCompat";
import { isTrainingCaseAiReviewFeatureEnabled } from "@/lib/features/enableTrainingCaseAiReview";
import {
  buildTrainingCaseAiReviewUserPrompt,
  TRAINING_CASE_AI_REVIEW_JSON_SCHEMA,
  TRAINING_CASE_AI_REVIEW_SYSTEM_PROMPT,
  type TrainingCaseAiPromptContext,
} from "./aiDraftPrompt";
import {
  AI_REVIEW_IMAGE_LIMITATION_COPY,
  type TrainingCaseAiReviewStructuredFeedback,
} from "./aiDraftTypes";
import {
  normalizeStructuredFeedbackFromRaw,
  validateTrainingCaseAiReviewFeedback,
} from "./aiDraftValidation";

const LOG_PREFIX = "[training-case-ai-review]";

/** Vision + strict JSON schema; override via OPENAI_TRAINING_REVIEW_MODEL */
const DEFAULT_TRAINING_REVIEW_MODEL = "gpt-4o";

export type TrainingCaseAiReviewImageInput = {
  uploadId: string;
  category: string;
  signedUrl: string;
};

export type TrainingCaseAiReviewProviderConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  maxImages: number;
  signedUrlTtlSeconds: number;
};

export type TrainingCaseAiReviewProviderResult =
  | {
      outcome: "success";
      model: string;
      feedback: TrainingCaseAiReviewStructuredFeedback;
      durationMs: number;
      imagesSent: number;
    }
  | {
      outcome: "not_configured";
      model: null;
      feedback: TrainingCaseAiReviewStructuredFeedback;
      staffMessage: string;
    }
  | {
      outcome: "provider_error";
      model: string | null;
      staffMessage: string;
      errorCode: string;
      durationMs: number;
    }
  | {
      outcome: "validation_failed";
      model: string;
      staffMessage: string;
      validationErrors: string[];
      rawFeedback: TrainingCaseAiReviewStructuredFeedback;
      durationMs: number;
    };

type CompletionMode = "json_schema" | "json_object" | "text_only";

function logInfo(message: string, meta?: Record<string, unknown>) {
  console.info(LOG_PREFIX, message, meta ?? {});
}

function logWarn(message: string, meta?: Record<string, unknown>) {
  console.warn(LOG_PREFIX, message, meta ?? {});
}

function logError(message: string, meta?: Record<string, unknown>) {
  console.error(LOG_PREFIX, message, meta ?? {});
}

function imageMeta(images: TrainingCaseAiReviewImageInput[]) {
  return images.map((i) => ({ uploadId: i.uploadId, category: i.category }));
}

function resolveTrainingReviewModel(env: Readonly<Record<string, string | undefined>>): string {
  return (
    env.OPENAI_TRAINING_REVIEW_MODEL?.trim() ||
    env.OPENAI_MODEL?.trim() ||
    DEFAULT_TRAINING_REVIEW_MODEL
  );
}

export function getTrainingCaseAiReviewProviderConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): TrainingCaseAiReviewProviderConfig {
  const apiKey = env.OPENAI_API_KEY?.trim() || null;
  return {
    enabled: isTrainingCaseAiReviewFeatureEnabled(env),
    apiKey,
    model: resolveTrainingReviewModel(env),
    maxImages: Math.min(12, Math.max(1, Number(env.TRAINING_CASE_AI_MAX_IMAGES) || 12)),
    signedUrlTtlSeconds: 300,
  };
}

export function isTrainingCaseAiReviewConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return getTrainingCaseAiReviewProviderConfig(env).enabled;
}

function buildNotConfiguredFeedback(
  imageCount: number,
  missingCategories: string[],
): TrainingCaseAiReviewStructuredFeedback {
  return {
    placeholder: true,
    overallSummary: "AI review is not configured for this environment.",
    imageQualityNotes:
      imageCount > 0
        ? [
            `${imageCount} active training image(s) are on file. Set OPENAI_API_KEY (and ensure ENABLE_TRAINING_CASE_AI_REVIEW is not false) to enable AI-assisted draft observations.`,
          ]
        : ["No active training images were found for this case."],
    missingCategories,
    strengths: [],
    improvementAreas: [],
    suggestedNextFocus: null,
    sectionSuggestions: [],
    safetyNotes: [
      "AI review is not configured for this environment.",
      AI_REVIEW_IMAGE_LIMITATION_COPY,
      "Faculty confirmation required before any feedback is released to the trainee.",
    ],
  };
}

function buildUserParts(
  promptContext: TrainingCaseAiPromptContext,
  images: TrainingCaseAiReviewImageInput[],
  includeImages: boolean,
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  const userParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: buildTrainingCaseAiReviewUserPrompt(promptContext) },
  ];

  if (!includeImages || !images.length) {
    userParts.push({
      type: "text",
      text: "\n## Training case images\n(none attached in this request — note limited evidence in output)",
    });
    return userParts;
  }

  userParts.push({ type: "text", text: "\n## Training case images (upload id + category)" });
  for (const img of images) {
    userParts.push({ type: "text", text: `upload_id: ${img.uploadId} · category: ${img.category}` });
    userParts.push({ type: "image_url", image_url: { url: img.signedUrl, detail: "low" } });
  }
  return userParts;
}

function staffMessageForApiError(err: APIError, model: string): string {
  const detail = typeof err.message === "string" ? err.message : "";
  const lower = detail.toLowerCase();

  if (err.status === 400) {
    if (lower.includes("temperature") || lower.includes("unsupported parameter")) {
      return `AI draft request failed: the configured model (${model}) does not support one or more request parameters. Set OPENAI_TRAINING_REVIEW_MODEL=gpt-4o and try again.`;
    }
    if (lower.includes("json_schema") || lower.includes("response_format") || lower.includes("schema")) {
      return `AI draft request failed: structured output schema was rejected. The service will retry automatically on the next attempt; if this persists, set OPENAI_TRAINING_REVIEW_MODEL=gpt-4o.`;
    }
    if (lower.includes("image") || lower.includes("download") || lower.includes("url")) {
      return `AI draft request failed: one or more training images could not be read by the AI service. Check that storage signed URLs are reachable, then try again or enter feedback manually.`;
    }
    return `AI draft request was rejected by the AI API (400). Try again, set OPENAI_TRAINING_REVIEW_MODEL=gpt-4o, or enter feedback manually.`;
  }

  if (err.status === 429) {
    return "AI draft request was rate-limited. Wait a moment and try again, or enter feedback manually.";
  }

  return `AI draft generation failed (openai_${err.status ?? "error"}). Faculty should enter feedback manually or try again later.`;
}

async function requestCompletion(
  client: OpenAI,
  model: string,
  userParts: OpenAI.Chat.Completions.ChatCompletionContentPart[],
  mode: CompletionMode,
): Promise<string> {
  const tokenParam = maxTokensParam(model, 3500);
  const base = {
    model,
    messages: [
      { role: "system" as const, content: TRAINING_CASE_AI_REVIEW_SYSTEM_PROMPT },
      { role: "user" as const, content: userParts },
    ],
    ...(supportsChatTemperature(model) ? { temperature: 0.25 } : {}),
    ...tokenParam,
  };

  if (mode === "json_schema") {
    const completion = await client.chat.completions.create({
      ...base,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: { type: "json_schema", json_schema: TRAINING_CASE_AI_REVIEW_JSON_SCHEMA } as any,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");
    return raw;
  }

  if (mode === "json_object") {
    const completion = await client.chat.completions.create({
      ...base,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");
    return raw;
  }

  const completion = await client.chat.completions.create(base);
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response");
  return raw;
}

async function callWithFallbacks(
  client: OpenAI,
  model: string,
  promptContext: TrainingCaseAiPromptContext,
  images: TrainingCaseAiReviewImageInput[],
  trainingCaseId: string,
): Promise<{ raw: string; imagesSent: number; mode: CompletionMode }> {
  const attempts: { mode: CompletionMode; includeImages: boolean }[] = [
    { mode: "json_schema", includeImages: true },
    { mode: "json_object", includeImages: true },
    ...(images.length
      ? [
          { mode: "json_schema" as const, includeImages: false },
          { mode: "json_object" as const, includeImages: false },
        ]
      : []),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    const parts = buildUserParts(promptContext, images, attempt.includeImages);
    const imagesSent = attempt.includeImages ? images.length : 0;
    try {
      logInfo("AI completion attempt", {
        trainingCaseId,
        model,
        mode: attempt.mode,
        includeImages: attempt.includeImages,
        imagesSent,
      });
      const raw = await requestCompletion(client, model, parts, attempt.mode);
      return { raw, imagesSent, mode: attempt.mode };
    } catch (e) {
      lastError = e;
      const status = e instanceof APIError ? e.status : undefined;
      logWarn("AI completion attempt failed", {
        trainingCaseId,
        model,
        mode: attempt.mode,
        includeImages: attempt.includeImages,
        status,
        message: e instanceof Error ? e.message : String(e),
      });
      if (!(e instanceof APIError) || (status !== 400 && status !== 422)) {
        throw e;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI request failed");
}

export async function runTrainingCaseAiReviewProvider(input: {
  trainingCaseId: string;
  promptContext: TrainingCaseAiPromptContext;
  images: TrainingCaseAiReviewImageInput[];
}): Promise<TrainingCaseAiReviewProviderResult> {
  const config = getTrainingCaseAiReviewProviderConfig();
  const started = Date.now();
  const missingCategories = input.promptContext.missingPhotoCategories;

  logInfo("AI review run started", {
    trainingCaseId: input.trainingCaseId,
    imageCount: input.promptContext.imageCount,
    imagesPrepared: input.images.length,
    configured: config.enabled,
    model: config.enabled ? config.model : null,
  });

  if (!config.enabled || !config.apiKey) {
    logWarn("AI review skipped — provider not configured", {
      trainingCaseId: input.trainingCaseId,
      hasApiKey: Boolean(config.apiKey),
    });
    return {
      outcome: "not_configured",
      model: null,
      staffMessage: "AI review is not configured for this environment. Faculty should enter feedback manually.",
      feedback: buildNotConfiguredFeedback(input.promptContext.imageCount, missingCategories),
    };
  }

  const imagesToSend = input.images.slice(0, config.maxImages);
  const client = new OpenAI({ apiKey: config.apiKey });

  try {
    const { raw, imagesSent, mode } = await callWithFallbacks(
      client,
      config.model,
      input.promptContext,
      imagesToSend,
      input.trainingCaseId,
    );

    const durationMs = Date.now() - started;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logError("AI response JSON parse failed", {
        trainingCaseId: input.trainingCaseId,
        model: config.model,
        mode,
        durationMs,
        contentLength: raw.length,
      });
      return {
        outcome: "provider_error",
        model: config.model,
        staffMessage:
          "The AI response could not be parsed. Please try again or enter feedback manually.",
        errorCode: "json_parse_error",
        durationMs,
      };
    }

    const normalized = normalizeStructuredFeedbackFromRaw(parsed);
    const validation = validateTrainingCaseAiReviewFeedback(normalized);

    if (!validation.ok) {
      logWarn("AI response validation failed", {
        trainingCaseId: input.trainingCaseId,
        model: config.model,
        mode,
        durationMs,
        images: imageMeta(imagesToSend),
        errors: validation.errors,
      });
      return {
        outcome: "validation_failed",
        model: config.model,
        staffMessage:
          "AI draft suggestions could not be validated safely. Faculty should enter feedback manually or regenerate.",
        validationErrors: validation.errors,
        rawFeedback: validation.partial ?? normalized,
        durationMs,
      };
    }

    logInfo("AI review completed", {
      trainingCaseId: input.trainingCaseId,
      model: config.model,
      mode,
      durationMs,
      imagesSent,
      sectionSuggestionCount: validation.feedback.sectionSuggestions?.length ?? 0,
    });

    return {
      outcome: "success",
      model: config.model,
      feedback: validation.feedback,
      durationMs,
      imagesSent,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    const err = e instanceof Error ? e : new Error("AI request failed");

    if (err instanceof APIError) {
      const errorCode = `openai_${err.status ?? "error"}`;
      logError("AI provider request failed", {
        trainingCaseId: input.trainingCaseId,
        model: config.model,
        durationMs,
        images: imageMeta(imagesToSend),
        errorCode,
        message: err.message,
      });
      return {
        outcome: "provider_error",
        model: config.model,
        staffMessage: staffMessageForApiError(err, config.model),
        errorCode,
        durationMs,
      };
    }

    logError("AI provider request failed", {
      trainingCaseId: input.trainingCaseId,
      model: config.model,
      durationMs,
      images: imageMeta(imagesToSend),
      message: err.message,
    });

    return {
      outcome: "provider_error",
      model: config.model,
      staffMessage: `AI draft generation failed. Faculty should enter feedback manually or try again later.`,
      errorCode: "provider_exception",
      durationMs,
    };
  }
}
