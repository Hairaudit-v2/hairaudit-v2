# Stage 1D — Upload validation and file trust hardening

## Goal

All **browser-facing image upload** API routes validate **actual file bytes** (magic numbers + Sharp decode metadata), not the client-declared `Content-Type` / `File.type` or filename extension.

Storage paths, route URLs, and database schemas are unchanged; only validation and canonical limits are centralized.

## Allowed formats

Server accepts **only**:

- `image/jpeg`
- `image/png`
- `image/webp`

**HEIC** is not accepted (no HEIC support in this codebase).

## Rejected content

- **SVG** (including XML/SVG sniffed in the first 8KB after optional BOM/whitespace)
- **Executables / archives / PDFs** at the start of the file: `MZ` (PE), `PK` (ZIP), `%PDF`, ELF
- **Wrong or unknown magic bytes** (anything that is not JPEG / PNG / WebP at offset 0, per `detectActualFileType`)
- **Polyglots / mismatches**: magic says one raster format but Sharp reports a different `format`
- **Invalid images**: Sharp cannot read metadata or dimensions
- **Oversized files** and **oversized dimensions** (see limits below)

## Canonical modules

| Module | Role |
|--------|------|
| `src/lib/uploads/uploadLimits.ts` | `MAX_IMAGE_UPLOAD_MB` (default **50**, override `UPLOAD_MAX_FILE_SIZE_MB`), `MAX_IMAGE_UPLOAD_BYTES`, `MAX_FILES_PER_IMAGE_REQUEST` (`UPLOAD_MAX_FILES_PER_REQUEST`), `MAX_IMAGE_DIMENSION_PX` (`UPLOAD_MAX_IMAGE_DIMENSION_PX`), `MAX_CONCURRENT_UPLOADS` |
| `src/lib/uploads/fileValidation.ts` | `validateUploadedImage`, `detectActualFileType`, `validateImageMagicBytes`, `rejectSvgUploads`, `rejectUnknownBinary`, `enforceMaxFileSize`, `normalizeAcceptedMimeType`, `validateImageDimensions` |
| `src/lib/uploads/safeUpload.ts` | `UPLOAD_LIMITS` (re-exports size/count from `uploadLimits.ts`), queues, retry, user-facing error strings |

## API routes wired to `validateUploadedImage`

These multipart image endpoints call `validateUploadedImage` before Supabase Storage upload and use **`normalizedMime`** + **`buffer.length`** for `contentType` / metadata (not `file.type` / `file.size`):

- `POST /api/uploads/patient-photos` — `src/app/api/uploads/patient-photos/route.ts`
- `POST /api/uploads/doctor-photos` — `src/app/api/uploads/doctor-photos/route.ts`
- `POST /api/uploads/clinic-photos` — `src/app/api/uploads/clinic-photos/route.ts`
- `POST /api/uploads/audit-photos` — `src/app/api/uploads/audit-photos/route.ts`
- `POST /api/surgery-upload/photos` — `src/app/api/surgery-upload/photos/route.ts`
- `POST /api/academy/uploads` — `src/app/api/academy/uploads/route.ts`
- `POST /api/admin/hair-audit/bulk-upload/images` — `src/app/api/admin/hair-audit/bulk-upload/images/route.ts`

**Not** in scope (server-generated or internal pipelines, not raw browser multipart):

- Inngest / PDF / evidence preparation uploads that already write known buffers (e.g. generated PDFs, optimized JPEGs from trusted Sharp pipelines).

## Environment overrides

- `UPLOAD_MAX_FILE_SIZE_MB` — per-file cap (1–200), default 50.
- `UPLOAD_MAX_FILES_PER_REQUEST` — multipart file count cap (1–50), default 10.
- `UPLOAD_MAX_IMAGE_DIMENSION_PX` — max width/height after decode (default 20000).

## Tests

Run:

```bash
pnpm test:file-validation
```

or:

```bash
pnpm exec tsx --test tests/fileValidation.test.ts
```

Covers magic-byte sniffing, dangerous prefixes, SVG rejection, oversize, invalid payloads, and a static check that all listed route files import the shared validator.
