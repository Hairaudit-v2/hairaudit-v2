/**
 * HA-INTELLIGENCE-5 — Supabase adapter for worker-time classifier metadata write-back.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ClassifierMetadataWriteBackAdapter } from "@/lib/hairaudit-intelligence/shadow/classifierMetadataWriteback.server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createSupabaseClassifierMetadataWriteBackAdapter(
  admin: SupabaseClient
): ClassifierMetadataWriteBackAdapter {
  return {
    async getUploadMetadata(uploadId) {
      const { data, error } = await admin
        .from("uploads")
        .select("metadata")
        .eq("id", uploadId)
        .maybeSingle();

      if (error || !data || !isRecord(data.metadata)) return {};
      return data.metadata;
    },

    async updateUploadMetadata(uploadId, metadata) {
      const { error } = await admin.from("uploads").update({ metadata }).eq("id", uploadId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  };
}

/** Resolve a write-back adapter when Supabase admin is available. */
export function resolveClassifierMetadataWriteBackAdapter(
  override?: ClassifierMetadataWriteBackAdapter
): ClassifierMetadataWriteBackAdapter | undefined {
  if (override) return override;
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return undefined;
  return createSupabaseClassifierMetadataWriteBackAdapter(admin);
}
