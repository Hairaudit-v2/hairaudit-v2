import type { SupabaseClient } from "@supabase/supabase-js";

export type PreparedImageManifestItem = {
  upload_id: string;
  original_path: string;
  prepared_path: string;
  category: string;
  width: number;
  height: number;
  mime_type: string;
  quality_label: "usable" | "weak" | "poor";
  notes: string;
};

export type CaseEvidenceManifest = {
  id: string;
  case_id: string;
  status: "processing" | "ready" | "failed";
  prepared_images: PreparedImageManifestItem[];
  quality_score: number;
  missing_categories: string[];
  errors: string[];
  created_at?: string;
  updated_at?: string;
};

export async function loadLatestEvidenceManifest(args: {
  supabase: SupabaseClient;
  caseId: string;
  status?: "processing" | "ready" | "failed";
}): Promise<CaseEvidenceManifest | null> {
  let query = args.supabase
    .from("case_evidence_manifests")
    .select("id, case_id, status, prepared_images, quality_score, missing_categories, errors, created_at, updated_at")
    .eq("case_id", args.caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (args.status) {
    query = query.eq("status", args.status);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as CaseEvidenceManifest;
}
