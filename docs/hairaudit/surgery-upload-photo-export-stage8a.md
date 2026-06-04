# Surgery upload — Stage 8A (Case Photo Export Pack)

**Note:** Stage **8B** extends this route with `?slots=`, CRM-oriented manifests, patient-name matching, export history UI, and `export_scope` values `category` / `multi_category`. See [surgery-upload-photo-export-stage8b.md](./surgery-upload-photo-export-stage8b.md).

## Behaviour

- **Route:** `GET /api/surgery-upload/cases/[caseId]/photo-export` (see 8B for `slot` / `slots`).
- **Runtime:** Node.js (`export const runtime = "nodejs"`).
- **Contents:** Only `uploads` rows with `type` matching `surgery_photo:*` and a known checklist slot.
- **Auth:** Signed-in user; `resolvePhotoPackExportRole` allows **auditor**, **doctor**, **clinic** only (patients always denied). `canAccessCase` must pass for the case.
- **Storage:** Service-role Supabase client downloads from `CASE_FILES_BUCKET` / `case-files` by `storage_path`. Missing objects are skipped, listed in `manifest.json`, and included in CSV with `file_included=false`. If **>50%** of requested files are missing, the export **fails** (500) after logging `photo_export_failed`.

## Limits (Stage 8A)

| Limit | Value |
|--------|--------|
| Max photos per request | 300 |
| Max estimated source bytes (metadata + 5MB/file unknown) | 500 MB |
| Max downloaded bytes mid-build | 500 MB (then 413) |
| Max output ZIP buffer | 2× source cap (safety) then 413 |

In-memory ZIP generation is acceptable; very large cases should use **category / multi-category** exports (`slot` / `slots`) or contact support — future stages may add streaming or multi-part archives.

## ZIP layout

Root folder: `Case-<sanitized-label>-<sanitized-reference>-<shortCaseId>/` (see `photoExportPack.ts`).

Per-slot subfolders (only if they contain at least one file):

`01-pre-op-donor` … `11-other` (aligned with `SURGERY_PHOTO_SLOTS` in `checklist.ts`).

Files: `<order>-<slot>-<UTC-date>-<shortUploadId>.<ext>`

Root also contains **`manifest.csv`** and **`manifest.json`** — see Stage 8B doc for the CRM-oriented manifest layout (8A shipped a flatter JSON; 8B nests `export` / `case` / `photos`).

## Logging

- Table: **`surgery_upload_photo_exports`** (migration `20260605130000_surgery_upload_photo_export_pack_stage8a.sql`). Inserts from API (service role); RLS read for auditors or `cases.doctor_id` / `cases.clinic_id` (patients excluded).
- Timeline: **`photo_export_created`** / **`photo_export_failed`** on `surgery_upload_evidence_events` with allow-listed metadata only (counts, scope, optional slot; no paths in UI summaries).

## UI

- **SurgeryUploadReviewPanel / SurgeryUploadFlowClient:** `SurgeryPhotoExportPackPanel` (Stage 8B) when `canExportPhotoPack` — see 8B doc.
- **Audit intake queue:** compact `SurgeryPhotoExportPackButton` (full-pack download only).

## Follow-on ideas (Stage 8C+)

- Streaming ZIP / temp file to reduce memory.
- Stronger preflight HEAD/stat on storage for size estimates.
- Admin “hair audit” role parity if introduced in `profiles.role`.
