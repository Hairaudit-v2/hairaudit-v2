/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — OpenAI Images API edit provider (gpt-image-2).
 * Image-to-image edit of the patient's frontal photograph with recipient mask guidance.
 * Never falls back to local-illustrative overlays for cosmetic outcomes.
 */

import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import type {
  PreSurgeryProjectionInput,
  PreSurgeryProjectionProvider,
  PreSurgeryProjectionResult,
} from "./provider";
import { buildRecipientEditMask } from "./treatmentMask";
import { buildOpenAiProjectedOutcomeEditPrompt, OPENAI_EDIT_PROMPT_VERSION } from "./openaiEditPrompt";
import { deriveProjectionModeAllocation } from "./modes";
import { compositeOutcomeWithinMask, normalizeProjectionRaster } from "./maskContainmentComposite";
import {
  computeAspectFitLayout,
  padImageToCanvas,
  parseOpenAiEditSize,
  unpadCanvasToSource,
  type OpenAiEditCanvasSize,
} from "./openaiEditGeometry";
import { ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER } from "./artifactTypes";

export const OPENAI_GPT_IMAGE_PROVIDER_ID = "openai-gpt-image" as const;
export const OPENAI_GPT_IMAGE_MODEL_DEFAULT = "gpt-image-2" as const;

export type OpenAiGptImageStorageDeps = {
  loadSourceBytes: (sourceImageRef: string) => Promise<Buffer>;
  storeOutput: (storagePath: string, bytes: Buffer, contentType: string) => Promise<void>;
};

export type OpenAiGptImageProviderOptions = {
  apiKey: string;
  model?: string;
  quality?: "low" | "medium" | "high" | "auto";
  outputFormat?: "png" | "jpeg" | "webp";
  /** Injected client for tests. */
  client?: OpenAI;
  timeoutMs?: number;
};

export type OpenAiProjectionMeta = {
  promptVersion: string;
  prompt: string;
  maskChecksum: string;
  sourceChecksum: string;
  widthPx: number;
  heightPx: number;
  mimeType: string;
  fileSizeBytes: number;
  zonesIncluded: string[];
  model: string;
  openaiRequestId?: string | null;
  blockerCode?: string | null;
};

export type PreSurgeryProjectionResultWithOpenAiMeta =
  | (Extract<PreSurgeryProjectionResult, { ok: true }> & {
      mimeType?: string;
      fileSizeBytes?: number;
      widthPx?: number;
      heightPx?: number;
      openAiMeta?: OpenAiProjectionMeta;
    })
  | (Extract<PreSurgeryProjectionResult, { ok: false }> & {
      blockerCategory?:
        | "model_access"
        | "organisation_verification"
        | "moderation"
        | "api_key_environment"
        | "billing"
        | "unsupported_request"
        | "implementation_failure";
    });

export function buildOpenAiProjectedOutcomeStoragePath(input: {
  caseId: string;
  mode: string;
  outputChecksum: string;
  extension?: string;
}): string {
  const ext = input.extension ?? "jpg";
  return `pre_surgery_projections/${input.caseId}/illustrative_projected_outcome/${input.mode}/${input.outputChecksum.slice(0, 16)}.${ext}`;
}

function classifyOpenAiError(err: unknown): {
  errorCode: string;
  message: string;
  blockerCategory:
    | "model_access"
    | "organisation_verification"
    | "moderation"
    | "api_key_environment"
    | "billing"
    | "unsupported_request"
    | "implementation_failure";
  retryable: boolean;
} {
  const anyErr = err as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    error?: { code?: string; type?: string; message?: string; moderation_details?: unknown };
  };
  const status = anyErr?.status;
  const code = String(anyErr?.error?.code ?? anyErr?.code ?? "").toLowerCase();
  const type = String(anyErr?.error?.type ?? anyErr?.type ?? "").toLowerCase();
  const message = String(anyErr?.error?.message ?? anyErr?.message ?? "OpenAI image edit failed");

  if (status === 401 || code.includes("invalid_api_key") || code.includes("authentication")) {
    return {
      errorCode: "openai_api_key_environment",
      message: `API-key/environment issue: ${message}`,
      blockerCategory: "api_key_environment",
      retryable: false,
    };
  }
  if (
    code.includes("billing") ||
    code.includes("insufficient_quota") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("billing")
  ) {
    return {
      errorCode: "openai_billing",
      message: `Billing/quota issue: ${message}`,
      blockerCategory: "billing",
      retryable: false,
    };
  }
  if (code === "moderation_blocked" || type.includes("moderation") || message.toLowerCase().includes("safety")) {
    return {
      errorCode: "openai_moderation",
      message: `Moderation blocked the request: ${message}`,
      blockerCategory: "moderation",
      retryable: false,
    };
  }
  if (
    message.toLowerCase().includes("verif") ||
    code.includes("organization") ||
    message.toLowerCase().includes("organization")
  ) {
    return {
      errorCode: "openai_organisation_verification",
      message: `Organisation verification required: ${message}`,
      blockerCategory: "organisation_verification",
      retryable: false,
    };
  }
  if (
    status === 404 ||
    code.includes("model") ||
    message.toLowerCase().includes("model") ||
    message.toLowerCase().includes("does not have access")
  ) {
    return {
      errorCode: "openai_model_access",
      message: `Model access issue: ${message}`,
      blockerCategory: "model_access",
      retryable: false,
    };
  }
  if (status === 400 || type.includes("invalid_request") || type.includes("user_error")) {
    return {
      errorCode: "openai_unsupported_request",
      message: `Unsupported request: ${message}`,
      blockerCategory: "unsupported_request",
      retryable: false,
    };
  }
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return {
      errorCode: "openai_transient",
      message,
      blockerCategory: "implementation_failure",
      retryable: true,
    };
  }
  return {
    errorCode: "openai_implementation_failure",
    message: `Implementation/provider failure: ${message}`,
    blockerCategory: "implementation_failure",
    retryable: true,
  };
}

/** Pick a portrait-friendly GPT Image size close to source aspect. */
export function pickOpenAiEditSize(
  widthPx: number,
  heightPx: number
): OpenAiEditCanvasSize {
  if (!widthPx || !heightPx) return "1024x1024";
  const ratio = widthPx / heightPx;
  // Prefer the nearest gpt-image canvas; letterbox instead of stretch-fill when ratios differ.
  if (ratio < 0.85) return "1024x1536";
  if (ratio > 1.15) return "1536x1024";
  return "1024x1024";
}

export function createOpenAiGptImageProjectionProvider(
  deps: OpenAiGptImageStorageDeps,
  options: OpenAiGptImageProviderOptions
): PreSurgeryProjectionProvider {
  const model = (options.model ?? OPENAI_GPT_IMAGE_MODEL_DEFAULT).trim() || OPENAI_GPT_IMAGE_MODEL_DEFAULT;
  const client =
    options.client ??
    new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs ?? 180_000,
    });

  return {
    async generateProjection(input: PreSurgeryProjectionInput): Promise<PreSurgeryProjectionResult> {
      if (!options.apiKey && !options.client) {
        return {
          ok: false,
          errorCode: "openai_api_key_environment",
          message: "API-key/environment issue: OPENAI_API_KEY is not configured",
          retryable: false,
          blockerCategory: "api_key_environment",
        } as PreSurgeryProjectionResultWithOpenAiMeta;
      }

      let sourceBytes: Buffer;
      try {
        sourceBytes = await deps.loadSourceBytes(input.sourceImageRef);
      } catch (e) {
        return {
          ok: false,
          errorCode: "source_image_unavailable",
          message: e instanceof Error ? e.message : "Could not load source image",
          retryable: true,
        };
      }
      if (!sourceBytes?.byteLength) {
        return {
          ok: false,
          errorCode: "source_image_empty",
          message: "Source image bytes are empty",
          retryable: false,
        };
      }

      const sourceChecksum = createHash("sha256").update(sourceBytes).digest("hex");
      const allocation = deriveProjectionModeAllocation(input.approvedGraftPlan, input.mode);

      // Normalize EXIF orientation once so mask, edit input, and composite share one pixel grid.
      const normalized = await normalizeProjectionRaster(sourceBytes);
      const workingSource = normalized.png;

      let mask;
      try {
        mask = await buildRecipientEditMask({
          sourceBytes: workingSource,
          plan: input.approvedGraftPlan,
          mode: input.mode,
          annotations: input.approvedAnnotations,
        });
      } catch (e) {
        return {
          ok: false,
          errorCode: "mask_build_failed",
          message: e instanceof Error ? e.message : "Treatment mask build failed",
          retryable: false,
          blockerCategory: "implementation_failure",
        } as PreSurgeryProjectionResultWithOpenAiMeta;
      }

      if (mask.editablePixelCount < 500) {
        return {
          ok: false,
          errorCode: "mask_empty",
          message: "Recipient edit mask has insufficient editable area",
          retryable: false,
          blockerCategory: "unsupported_request",
        } as PreSurgeryProjectionResultWithOpenAiMeta;
      }

      const { prompt, promptVersion, assumptions } = buildOpenAiProjectedOutcomeEditPrompt({
        plan: input.approvedGraftPlan,
        mode: input.mode,
        zonesIncluded: mask.zonesIncluded,
        assumptions: allocation.assumptions,
      });

      // Letterbox into the nearest gpt-image canvas so we never aspect-stretch on the way back.
      const size = pickOpenAiEditSize(mask.widthPx, mask.heightPx);
      const canvas = parseOpenAiEditSize(size);
      if (!canvas) {
        return {
          ok: false,
          errorCode: "openai_size_unsupported",
          message: "Could not resolve OpenAI edit canvas size",
          retryable: false,
          blockerCategory: "implementation_failure",
        } as PreSurgeryProjectionResultWithOpenAiMeta;
      }
      const layout = computeAspectFitLayout({
        sourceWidth: mask.widthPx,
        sourceHeight: mask.heightPx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });

      try {
        const paddedSource = await padImageToCanvas({
          bytes: workingSource,
          layout,
          background: { r: 0, g: 0, b: 0, alpha: 255 },
        });
        // Letterbox bands must stay opaque (preserve) so only the patient region is editable.
        const paddedMask = await padImageToCanvas({
          bytes: mask.maskPng,
          layout,
          background: { r: 0, g: 0, b: 0, alpha: 255 },
        });

        const imageFile = await toFile(paddedSource, "source.png", { type: "image/png" });
        const maskFile = await toFile(paddedMask, "mask.png", { type: "image/png" });

        // Omit input_fidelity for gpt-image-2 (always high-fidelity per OpenAI docs).
        const editParams: Parameters<OpenAI["images"]["edit"]>[0] = {
          model,
          image: imageFile,
          mask: maskFile,
          prompt,
          n: 1,
          quality: options.quality ?? "high",
          output_format: options.outputFormat ?? "jpeg",
          size,
        };

        const response = await client.images.edit(editParams);
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) {
          return {
            ok: false,
            errorCode: "openai_empty_response",
            message: "OpenAI image edit returned no image data",
            retryable: true,
            blockerCategory: "implementation_failure",
          } as PreSurgeryProjectionResultWithOpenAiMeta;
        }

        let outputBytes = Buffer.from(b64, "base64");
        const responseMeta = await sharp(outputBytes).metadata();
        const responseW = responseMeta.width ?? 0;
        const responseH = responseMeta.height ?? 0;
        // If the API returns the requested canvas, unpad; otherwise refuse stretch-fill mismatch.
        if (responseW === layout.canvasWidth && responseH === layout.canvasHeight) {
          const unpadded = await unpadCanvasToSource({
            bytes: outputBytes,
            layout,
            outputFormat: "jpeg",
          });
          outputBytes = unpadded.bytes;
        } else if (
          responseW > 0 &&
          responseH > 0 &&
          Math.abs(responseW / responseH - mask.widthPx / mask.heightPx) < 0.02
        ) {
          // Same aspect as source — safe resize without shear.
          outputBytes = await sharp(outputBytes)
            .resize(mask.widthPx, mask.heightPx, { fit: "fill", kernel: "lanczos3" })
            .jpeg({ quality: 90, mozjpeg: true })
            .toBuffer();
        } else {
          return {
            ok: false,
            errorCode: "openai_aspect_mismatch",
            message: `OpenAI returned ${responseW}x${responseH}; cannot restore source aspect ${mask.widthPx}x${mask.heightPx} without shear`,
            retryable: true,
            blockerCategory: "unsupported_request",
          } as PreSurgeryProjectionResultWithOpenAiMeta;
        }

        // Hard containment mask restores identity outside the planned recipient region.
        const contained = await compositeOutcomeWithinMask({
          sourceBytes: workingSource,
          modelOutputBytes: outputBytes,
          maskPng: mask.hardMaskPng,
        });
        outputBytes = contained.bytes;

        const outMeta = await sharp(outputBytes).metadata();
        const outputChecksum = createHash("sha256").update(outputBytes).digest("hex");
        const outputStorageRef = buildOpenAiProjectedOutcomeStoragePath({
          caseId: input.caseId,
          mode: input.mode,
          outputChecksum,
          extension: "jpg",
        });

        await deps.storeOutput(outputStorageRef, outputBytes, "image/jpeg");

        const result: PreSurgeryProjectionResultWithOpenAiMeta = {
          ok: true,
          outputStorageRef,
          outputChecksum,
          limitations: [
            ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
            "OpenAI mask adherence is guidance-based; out-of-mask pixels were restored from the source photograph after generation.",
            "Clinician approval required before patient sharing.",
            ...input.patientSafeProjectionConstraints,
          ],
          planningAssumptions: [
            `provider=${OPENAI_GPT_IMAGE_PROVIDER_ID}`,
            `model=${model}`,
            `promptVersion=${promptVersion}`,
            `graftCount=${assumptions.graftCount}`,
            `survival=${assumptions.assumedGraftSurvivalRangePct.min}-${assumptions.assumedGraftSurvivalRangePct.max}%`,
            `hairsPerGraft=${assumptions.hairsPerGraftAssumption}`,
            `density=${assumptions.projectedDensityRange.minPerCm2}-${assumptions.projectedDensityRange.maxPerCm2}/cm2`,
            `zones=${mask.zonesIncluded.join(",")}`,
            `maskChecksum=${mask.maskChecksum}`,
            `hardMaskChecksum=${mask.hardMaskChecksum}`,
            `sourceChecksum=${sourceChecksum}`,
            `containmentComposite=true`,
            `editCanvas=${size}`,
            `aspectFitPad=true`,
          ],
          mode: input.mode,
          modelVersion: model,
          mimeType: "image/jpeg",
          fileSizeBytes: outputBytes.byteLength,
          widthPx: outMeta.width ?? contained.widthPx,
          heightPx: outMeta.height ?? contained.heightPx,
          openAiMeta: {
            promptVersion,
            prompt,
            maskChecksum: mask.maskChecksum,
            sourceChecksum,
            widthPx: outMeta.width ?? contained.widthPx,
            heightPx: outMeta.height ?? contained.heightPx,
            mimeType: "image/jpeg",
            fileSizeBytes: outputBytes.byteLength,
            zonesIncluded: mask.zonesIncluded,
            model,
            openaiRequestId: (response as { _request_id?: string })._request_id ?? null,
          },
        };
        return result;
      } catch (e) {
        const classified = classifyOpenAiError(e);
        return {
          ok: false,
          errorCode: classified.errorCode,
          message: classified.message,
          retryable: classified.retryable,
          blockerCategory: classified.blockerCategory,
        } as PreSurgeryProjectionResultWithOpenAiMeta;
      }
    },

    async healthcheck() {
      const started = Date.now();
      if (!options.apiKey && !options.client) {
        return {
          healthy: false,
          detail: "OPENAI_API_KEY missing",
          latencyMs: Date.now() - started,
        };
      }
      return {
        healthy: true,
        detail: `${OPENAI_GPT_IMAGE_PROVIDER_ID} / ${model} ready (key configured)`,
        latencyMs: Date.now() - started,
      };
    },
  };
}
