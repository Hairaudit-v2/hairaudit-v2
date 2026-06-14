/**
 * Standard image validation for HairAudit case-files upload API routes
 * (patient, doctor, clinic, audit, surgery). Uses magic-byte sniffing + Sharp decode;
 * never trust browser `File.type` or filename alone.
 *
 * @see {@link validateUploadedImage} in `./fileValidation`
 */

export { validateUploadedImage as validateCaseFilesRouteImage } from "@/lib/uploads/fileValidation";
export { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from "@/lib/uploads/uploadLimits";
