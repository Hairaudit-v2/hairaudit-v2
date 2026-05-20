import OpenAI from "openai";
import { maxTokensParam } from "@/lib/ai/openaiTokenCompat";
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

function logInfo(message: string, meta?: Record<string, unknown>) {
  console.info(LOG_PREFIX, message, meta ?? {});
}

function logWarn(message: string, meta?: Record<string, unknown>) {
  console.warn(LOG_PREFIX, message, meta ?? {});
}

function logError(message: string, meta?: Record<string, unknown>) {
  console.error(LOG_PREFIX, message, meta ?? {});
}

/** Never log signed URLs or storage paths — upload ids and categories only */
function imageMeta(images: TrainingCaseAiReviewImageInput[]) {
  return images.map((i) => ({ uploadId: i.uploadId, category: i.category }));
}

export function getTrainingCaseAiReviewProviderConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): TrainingCaseAiReviewProviderConfig {
  const apiKey = env.OPENAI_API_KEY?.trim() || null;
  return {
    enabled: isTrainingCaseAiReviewFeatureEnabled(env),
    apiKey,
    model: env.OPENAI_TRAINING_REVIEW_MODEL?.trim() || env.OPENAI_MODEL?.trim() || "gpt-4o",
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

  const userParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: buildTrainingCaseAiReviewUserPrompt(input.promptContext) },
  ];

  if (imagesToSend.length) {
    userParts.push({ type: "text", text: "\n## Training case images (upload id + category)" });
    for (const img of imagesToSend) {
      userParts.push({ type: "text", text: `upload_id: ${img.uploadId} · category: ${img.category}` });
      userParts.push({ type: "image_url", image_url: { url: img.signedUrl, detail: "low" } });
    }
  } else {
    userParts.push({
      type: "text",
      text: "\n## Training case images\n(none active — emphasize limited evidence, widen uncertainty, and list missingCategories)",
    });
  }

  try {
    const tokenParam = maxTokensParam(config.model, 3500);
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: TRAINING_CASE_AI_REVIEW_SYSTEM_PROMPT },
        { role: "user", content: userParts },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: { type: "json_schema", json_schema: TRAINING_CASE_AI_REVIEW_JSON_SCHEMA } as any,
      temperature: 0.25,
      ...tokenParam,
    });

    const durationMs = Date.now() - started;
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logError("Empty AI response", {
        trainingCaseId: input.trainingCaseId,
        model: config.model,
        durationMs,
        images: imageMeta(imagesToSend),
      });
      return {
        outcome: "provider_error",
        model: config.model,
        staffMessage:
          "The AI service returned an empty response. Please try again or enter feedback manually.",
        errorCode: "empty_response",
        durationMs,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logError("AI response JSON parse failed", {
        trainingCaseId: input.trainingCaseId,
        model: config.model,
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
      durationMs,
      imagesSent: imagesToSend.length,
      sectionSuggestionCount: validation.feedback.sectionSuggestions?.length ?? 0,
    });

    return {
      outcome: "success",
      model: config.model,
      feedback: validation.feedback,
      durationMs,
      imagesSent: imagesToSend.length,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    const err = e instanceof Error ? e : new Error("AI request failed");
    const errorCode =
      err instanceof OpenAI.APIError ? `openai_${err.status ?? "error"}` : "provider_exception";

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
      staffMessage: `AI draft generation failed (${errorCode}). Faculty should enter feedback manually or try again later.`,
      errorCode,
      durationMs,
    };
  }
}
