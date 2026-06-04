# Surgery upload — Stage 8B (Category export + patient matching + CRM prep)

Builds on [Stage 8A](./surgery-upload-photo-export-stage8a.md): same security model, limits, and storage behaviour unless noted below.

## Export scopes (`export_scope` column + timeline metadata)

| Scope | When | `slot_key` | `metadata.slot_keys` |
|--------|------|--------------|------------------------|
| `all` | No `slot` / `slots` query | `null` | `[]` |
| `category` | Single `?slot=` or one slot in `?slots=` | that slot | one element |
| `multi_category` | `?slots=a,b,c` (2+ keys) | `null` | ordered keys |

Legacy rows may still show `export_scope = slot` from early 8A; the UI history mapper treats `slot` like `category`.

## Patient / case matching

- **`patient_name`:** `profiles.display_name` for `cases.patient_id`, passed through `sanitizePatientDisplayName` (no `@`, no long digit runs, length-capped). Omitted in CSV/JSON when empty.
- **`patient_reference`:** `surgery_upload_details.patient_reference` (trimmed).
- **`case_reference`:** `patient_reference` → else `cases.title` → else short case id (8 hex chars, no full UUID in filename when avoidable).

ZIP display name (attachment uses ASCII variant):

1. `HairAudit-Surgery-Photos-<PatientName>-<CaseReference>-<SurgeryDate>.zip` when patient name present  
2. Else `HairAudit-Surgery-Photos-<CaseReference>-<SurgeryDate>.zip` when case reference ≠ short id  
3. Else `HairAudit-Surgery-Photos-<ShortCaseId>-<SurgeryDate>.zip`

Root folder: `Case-<patientName>-<caseReference>-<shortId>` or `Case-<caseReference>-<shortId>`.

## API query params

`GET /api/surgery-upload/cases/[caseId]/photo-export`

| Param | Meaning |
|--------|---------|
| _(none)_ | All surgery photos |
| `slot=<key>` | Single category |
| `slots=key1,key2,...` | Multiple categories (comma-separated, validated, deduped, max = number of checklist slots) |

**Do not** send both `slot` and `slots` — returns **400** with `Use either slot or slots, not both.`

## Manifest (CRM-oriented)

### `manifest.csv`

User-facing columns only (no `storage_path`, no `case_id`, no auth ids):

`patient_name`, `patient_reference`, `case_reference`, `surgery_date`, `clinic_name`, `surgeon`, `procedure_type`, `photo_category`, `photo_category_key`, `original_filename`, `exported_filename`, `uploaded_at`, `uploaded_by`, `added_after_review_request`, `quality_warning`, `width`, `height`, `original_size_bytes`, `compressed_size_bytes`, `file_included`, `skip_reason`

`uploaded_by` is the uploader’s user id string (legacy compatibility); omit from CRM mapping if your policy forbids storing ids.

### `manifest.json`

Top-level shape:

```json
{
  "export": { "generated_at", "export_scope", "selected_slots", "photo_count", "included_file_count", "skipped_file_count" },
  "case": { "patient_name", "patient_reference", "case_reference", "surgery_date", "clinic_name", "surgeon", "procedure_type" },
  "photos": [ { "...row fields...", "internal": { "upload_id", "storage_path" } } ],
  "internal": { "case_id", "zip_filename", "downloaded_source_bytes", "note" }
```

Prefer **CSV** for generic CRM imports; JSON `internal` / per-photo `internal` is for controlled technical integrations.

## Export logging metadata (completed)

Includes: `slot_keys`, `patient_name_included`, `case_reference`, `zip_filename`, `skipped_count`, `included_count`, `requested_count`, byte counts.

## UI

- **`SurgeryPhotoExportPackPanel`:** download all, per-category quick download, multi-select + “Download selected”, privacy copy (including category hint), optional **export history** list.
- **History loader:** `loadPhotoExportHistory` in `src/lib/surgeryUpload/photoExportHistory.ts` (server-side; case access required before call).
- **Audit intake:** still uses compact `SurgeryPhotoExportPackButton` (full-pack download only).

## Access / privacy

Unchanged from 8A: no patients, no public links, no path in CSV, `clinic_profile_id` is not an access grant. Timeline summaries avoid raw paths; failed export notes are path-stripped in history UI.

## Limitations & Stage 8C / 9 ideas

- In-memory ZIP (same as 8A).
- Export history does not auto-refresh after download until page refresh.
- Future: streaming ZIP, signed-URL handoff only with explicit product spec, OAuth CRM connectors, webhook on export completion.
