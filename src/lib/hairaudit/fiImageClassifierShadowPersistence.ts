/**
 * FIN-IMAGING-3 — shadow comparison persistence (service-role only).
 */

import { canCreateSupabaseAdminClient, createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ClassifierShadowComparisonRecord = {
  id?: string;
  upload_id: string;
  case_id: string;
  legacy_category: string;
  unified_category: string;
  categories_match: boolean;
  confidence_delta: number | null;
  quality_delta: number | null;
  blur_delta: number | null;
  protocol_delta: number | null;
  latency_ms: number;
  unified_fallback_used: boolean;
  provider: string;
  processing_version: string;
  legacy_latency_ms: number | null;
  legacy_provider: string | null;
  created_at?: string;
};

export type ClassifierShadowPersistenceAdapter = {
  insert(record: Omit<ClassifierShadowComparisonRecord, "id" | "created_at">): Promise<{
    ok: boolean;
    record?: ClassifierShadowComparisonRecord;
    error?: string;
  }>;
};

const memoryStore: ClassifierShadowComparisonRecord[] = [];

export function createMemoryClassifierShadowPersistence(): ClassifierShadowPersistenceAdapter {
  return {
    async insert(record) {
      const stored: ClassifierShadowComparisonRecord = {
        ...record,
        id: `mem-${memoryStore.length + 1}`,
        created_at: new Date().toISOString(),
      };
      memoryStore.push(stored);
      return { ok: true, record: stored };
    },
  };
}

function createSupabaseClassifierShadowPersistence(): ClassifierShadowPersistenceAdapter | null {
  if (!canCreateSupabaseAdminClient()) return null;
  const admin = createSupabaseAdminClient();

  return {
    async insert(record) {
      const { data, error } = await admin
        .from("hairaudit_classifier_shadow_comparisons")
        .insert({
          upload_id: record.upload_id,
          case_id: record.case_id,
          legacy_category: record.legacy_category,
          unified_category: record.unified_category,
          categories_match: record.categories_match,
          confidence_delta: record.confidence_delta,
          quality_delta: record.quality_delta,
          blur_delta: record.blur_delta,
          protocol_delta: record.protocol_delta,
          latency_ms: record.latency_ms,
          unified_fallback_used: record.unified_fallback_used,
          provider: record.provider,
          processing_version: record.processing_version,
          legacy_latency_ms: record.legacy_latency_ms,
          legacy_provider: record.legacy_provider,
        })
        .select("*")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true, record: data as ClassifierShadowComparisonRecord };
    },
  };
}

let cachedAdapter: ClassifierShadowPersistenceAdapter | null | undefined;

export function resolveClassifierShadowPersistence(
  override?: ClassifierShadowPersistenceAdapter
): ClassifierShadowPersistenceAdapter {
  if (override) return override;
  if (cachedAdapter) return cachedAdapter;
  cachedAdapter = createSupabaseClassifierShadowPersistence() ?? createMemoryClassifierShadowPersistence();
  return cachedAdapter;
}

export async function insertClassifierShadowComparison(
  record: Omit<ClassifierShadowComparisonRecord, "id" | "created_at">,
  adapter?: ClassifierShadowPersistenceAdapter
): Promise<{ ok: boolean; record?: ClassifierShadowComparisonRecord; error?: string }> {
  const persistence = resolveClassifierShadowPersistence(adapter);
  return persistence.insert(record);
}

/** Test helper — clears in-memory fallback store. */
export function resetMemoryClassifierShadowStoreForTests(): void {
  memoryStore.length = 0;
}

/** Test helper — read in-memory shadow comparisons. */
export function getMemoryClassifierShadowRecordsForTests(): ClassifierShadowComparisonRecord[] {
  return [...memoryStore];
}
