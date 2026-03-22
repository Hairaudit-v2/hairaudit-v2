/**
 * Upload helpers: storage + uploads table for patient, doctor, clinic.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionType } from "../config/canonicalMappings";
import { uploadTypePrefix } from "../config/canonicalMappings";
import { getDefaultImageBuffer } from "./imageBuffer";
import { normalizePatientPhotoCategory } from "@/lib/photoCategories";
import {
  applyPatientPhotoCategoryFields,
  syncPatientPhotoMetadataCategoryToType,
} from "@/lib/uploads/patientPhotoCategoryIntegrity";
import * as path from "path";
import * as fs from "fs";

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Upload a single file to storage and insert upload row. */
export async function uploadFileForCategory(
  supabase: SupabaseClient,
  options: {
    caseId: string;
    userId: string;
    submissionType: SubmissionType;
    category: string;
    filePath?: string;
    buffer?: Buffer;
  }
): Promise<{ id: string; type: string; storage_path: string }> {
  const { caseId, userId, submissionType, category, filePath, buffer } = options;
  const canonicalCategory =
    submissionType === "patient"
      ? (() => {
          try {
            return normalizePatientPhotoCategory(category);
          } catch {
            return category;
          }
        })()
      : category;
  const prefix = uploadTypePrefix(submissionType);

  let data: Buffer;
  let contentType = "image/jpeg";
  let originalName = "harness.jpg";

  if (buffer) {
    data = buffer;
  } else if (filePath && fs.existsSync(filePath)) {
    data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") contentType = "image/png";
    originalName = path.basename(filePath);
  } else {
    data = await getDefaultImageBuffer();
  }

  const segment = submissionType === "patient" ? "patient" : submissionType === "doctor" ? "doctor" : "clinic";
  const storagePath = `cases/${caseId}/${segment}/${canonicalCategory}/${Date.now()}-${safeName(originalName)}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, data, {
    contentType,
    upsert: false,
  });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  const baseMeta = {
    original_name: originalName,
    mime: contentType,
    size: data.length,
  };
  const { type, metadata } =
    submissionType === "patient"
      ? applyPatientPhotoCategoryFields(canonicalCategory, baseMeta)
      : { type: `${prefix}${canonicalCategory}`, metadata: { ...baseMeta, category: canonicalCategory } };

  const { data: row, error: insErr } = await supabase
    .from("uploads")
    .insert({
      case_id: caseId,
      user_id: userId,
      type,
      storage_path: storagePath,
      metadata,
    })
    .select("id, type, storage_path")
    .single();

  if (insErr) throw new Error(`uploads insert failed: ${insErr.message}`);
  return { id: row.id, type: row.type, storage_path: row.storage_path };
}

/** Attach images for all categories in mapping (category -> path or true for default). */
export async function attachImagesForScenario(
  supabase: SupabaseClient,
  options: {
    caseId: string;
    userId: string;
    submissionType: SubmissionType;
    imageMapping: Record<string, string | true>;
    fixturesDir?: string;
  }
): Promise<{ type: string }[]> {
  const { caseId, userId, submissionType, imageMapping, fixturesDir } = options;
  const results: { type: string }[] = [];
  const defaultBuffer = await getDefaultImageBuffer();

  for (const [category, pathOrTrue] of Object.entries(imageMapping)) {
    const filePath =
      pathOrTrue === true
        ? undefined
        : pathOrTrue.startsWith("/") || pathOrTrue.match(/^[A-Za-z]:/)
          ? pathOrTrue
          : fixturesDir
            ? path.join(fixturesDir, pathOrTrue)
            : pathOrTrue;
    const uploaded = await uploadFileForCategory(supabase, {
      caseId,
      userId,
      submissionType,
      category,
      filePath: filePath as string | undefined,
      buffer: !filePath || !fs.existsSync(filePath as string) ? defaultBuffer : undefined,
    });
    results.push({ type: uploaded.type });
  }

  return results;
}

/** Insert upload row with legacy type (for legacy-alias scenarios). Does not upload to storage. */
export async function insertLegacyUploadRow(
  supabase: SupabaseClient,
  options: {
    caseId: string;
    userId: string;
    type: string;
    storage_path: string;
  }
): Promise<{ type: string }> {
  const legacyMeta = syncPatientPhotoMetadataCategoryToType(options.type, {
    category: options.type.split(":")[1],
    original_name: "legacy.jpg",
    mime: "image/jpeg",
    size: 0,
  });

  const { data, error } = await supabase
    .from("uploads")
    .insert({
      case_id: options.caseId,
      user_id: options.userId,
      type: options.type,
      storage_path: options.storage_path,
      metadata: legacyMeta,
    })
    .select("type")
    .single();
  if (error) throw new Error(`legacy upload insert failed: ${error.message}`);
  return { type: data.type };
}
