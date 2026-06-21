/**
 * Patient photo compression — thin wrapper around the shared canvas compressor.
 * Used before upload to stay under request size limits on mobile.
 */

import {
  prepareImageForUpload,
  type PreparedImageMeta,
} from "@/lib/uploads/compressImage";
import { PATIENT_UPLOAD_COMPRESS_OPTS } from "@/lib/uploads/patientUploadClient";

export type { PreparedImageMeta };

export async function compressPatientPhoto(file: File): Promise<{
  file: File;
  meta: PreparedImageMeta;
}> {
  return prepareImageForUpload(file, PATIENT_UPLOAD_COMPRESS_OPTS);
}
