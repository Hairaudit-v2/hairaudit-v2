# Surgery upload — Stage 8A (Case Photo Export Pack)

## Behaviour

- **Route:** `GET /api/surgery-upload/cases/[caseId]/photo-export` (optional `?slot=<slotKey>`).
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

In-memory ZIP generation is acceptable for Stage 8A; very large cases should use **`?slot=`** (same limits per request) or contact support — **Stage 8B** can add multi-part or server-side streaming exports.

## ZIP layout

Root folder: `Case-<sanitized-label>-<sanitized-reference>-<shortCaseId>/` (see `photoExportPack.ts`).

Per-slot subfolders (only if they contain at least one file):

`01-pre-op-donor` … `11-other` (aligned with `SURGERY_PHOTO_SLOTS` in `checklist.ts`).

Files: `<order>-<slot>-<UTC-date>-<shortUploadId>.<ext>`

Root also contains **`manifest.csv`** (no raw storage paths) and **`manifest.json`** (per-row `internal.storage_path` for integrations).

## Logging

- Table: **`surgery_upload_photo_exports`** (migration `20260605130000_surgery_upload_photo_export_pack_stage8a.sql`). Inserts from API (service role); RLS read for auditors or `cases.doctor_id` / `cases.clinic_id` (patients excluded).
- Timeline: **`photo_export_created`** / **`photo_export_failed`** on `surgery_upload_evidence_events` with allow-listed metadata only (counts, scope, optional slot; no paths in UI summaries).

## UI

- **SurgeryUploadReviewPanel:** export block when `canExportPhotoPack` (case page passes auditor/doctor/clinic).
- **SurgeryUploadFlowClient:** submitted confirmation + “needs more evidence” flow.
- **Audit intake queue:** compact link (no local photo count; API enforces).

## Stage 8B ideas

- Streaming ZIP / temp file to reduce memory.
- Multi-select slot export UI.
- Stronger preflight HEAD/stat on storage for size estimates.
- Admin “hair audit” role parity if introduced in `profiles.role`.
