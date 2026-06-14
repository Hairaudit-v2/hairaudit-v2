/**
 * Canonical upload size / batch limits for HairAudit image APIs.
 * Override with env for constrained hosts (e.g. small serverless body limits).
 *
 * @see docs/stage1d-upload-validation-hardening.md
 */

const envMaxMb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB);
/** Max size per image file (megabytes). Default 50 (matches user-facing copy). */
export const MAX_IMAGE_UPLOAD_MB =
  Number.isFinite(envMaxMb) && envMaxMb > 0 && envMaxMb <= 200 ? envMaxMb : 50;

export const MAX_IMAGE_UPLOAD_BYTES = Math.floor(MAX_IMAGE_UPLOAD_MB * 1024 * 1024);

const envMaxFiles = Number(process.env.UPLOAD_MAX_FILES_PER_REQUEST);
/** Max files accepted in one multipart request for multi-file endpoints. */
export const MAX_FILES_PER_IMAGE_REQUEST =
  Number.isFinite(envMaxFiles) && envMaxFiles > 0 && envMaxFiles <= 50 ? Math.floor(envMaxFiles) : 10;

export const MAX_CONCURRENT_UPLOADS = 3;

/** Hard cap on decoded width/height (pixels) after Sharp reads metadata. */
const envMaxDim = Number(process.env.UPLOAD_MAX_IMAGE_DIMENSION_PX);
export const MAX_IMAGE_DIMENSION_PX =
  Number.isFinite(envMaxDim) && envMaxDim > 0 && envMaxDim <= 50000 ? Math.floor(envMaxDim) : 20000;
