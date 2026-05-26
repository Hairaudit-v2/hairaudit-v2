import type { SupabaseClient } from "@supabase/supabase-js";
import { BULK_TO_DOCTOR_PHOTO_KEY, type BulkImageCategory } from "./constants";

type BulkImageRow = {
  id: string;
  case_id: string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  image_category: BulkImageCategory | null;
};

export async function syncBulkImagesToUploads(
  admin: SupabaseClient,
  caseId: string,
  userId: string,
  images: BulkImageRow[]
): Promise<{ synced: number; errors: string[] }> {
  const caseImages = images.filter((img) => img.case_id === caseId);
  const errors: string[] = [];
  let synced = 0;

  for (const img of caseImages) {
    const category = img.image_category ?? "other";
    const auditKey = BULK_TO_DOCTOR_PHOTO_KEY[category] ?? "img_preop_front";
    const typeValue = `doctor_photo:${auditKey}`;

    const { data: existing } = await admin
      .from("uploads")
      .select("id")
      .eq("case_id", caseId)
      .eq("storage_path", img.storage_path)
      .maybeSingle();

    if (existing?.id) {
      synced++;
      continue;
    }

    const { error } = await admin.from("uploads").insert({
      case_id: caseId,
      user_id: userId,
      type: typeValue,
      storage_path: img.storage_path,
      metadata: {
        bulk_image_id: img.id,
        bulk_category: category,
        audit_category: auditKey,
        original_name: img.file_name,
        mime: img.mime_type,
        source: "hair_audit_bulk_upload",
      },
    });

    if (error) {
      errors.push(error.message);
    } else {
      synced++;
    }
  }

  return { synced, errors };
}
