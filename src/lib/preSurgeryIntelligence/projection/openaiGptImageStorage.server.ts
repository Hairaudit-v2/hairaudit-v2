/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — Bind OpenAI provider to case-files storage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalIllustrativeStorageDeps } from "./localIllustrativeStorage.server";
import {
  OPENAI_GPT_IMAGE_MODEL_DEFAULT,
  OPENAI_GPT_IMAGE_PROVIDER_ID,
  createOpenAiGptImageProjectionProvider,
} from "./openaiGptImageProvider";

export function createBoundOpenAiGptImageProvider(args: {
  admin: SupabaseClient;
  resolveImageIdToPath?: (imageId: string) => Promise<string | null>;
  apiKey?: string;
  model?: string;
}) {
  const apiKey = (args.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
  const model =
    (args.model ?? process.env.HA_OPENAI_GPT_IMAGE_MODEL ?? OPENAI_GPT_IMAGE_MODEL_DEFAULT).trim() ||
    OPENAI_GPT_IMAGE_MODEL_DEFAULT;
  const deps = createLocalIllustrativeStorageDeps({
    admin: args.admin,
    resolveImageIdToPath: args.resolveImageIdToPath,
  });
  return {
    providerId: OPENAI_GPT_IMAGE_PROVIDER_ID as string,
    modelVersion: model,
    provider: createOpenAiGptImageProjectionProvider(deps, { apiKey, model }),
  };
}
