# Surgery upload photo export — CRM/CMS integration prep (Stage 8C)

This document describes the **current** HairAudit Mobile Surgery Upload Portal photo export pack, the **version 1** manifest schema, security boundaries, logging, and **recommended** future integration patterns. It does **not** implement third-party connectors.

Related: [Stage 8A — export pack](./surgery-upload-photo-export-stage8a.md), [Stage 8B — categories & history](./surgery-upload-photo-export-stage8b.md).

---

## Current export pack workflow

1. An authenticated **auditor**, **doctor**, or **clinic** user opens a case they can access (same `canAccessCase` rules as the rest of the portal).
2. The user requests a ZIP from `GET /api/surgery-upload/cases/[caseId]/photo-export` with optional query params:
   - No params — all surgery photo categories present on the case.
   - `?slot=<key>` — single category.
   - `?slots=a,b,c` — multiple categories (comma-separated slot keys).
3. The API loads surgery `uploads` rows, filters to **surgery_photo** evidence only, downloads each file from Supabase Storage (service role on server), builds a ZIP with:
   - One root folder (case-labelled).
   - Subfolders per photo category (stable ordering from the checklist).
   - `manifest.csv` and `manifest.json` (CRM-oriented metadata).
4. The response is **`application/zip`** with `Content-Disposition: attachment` (no public share link).
5. A row is written to **`surgery_upload_photo_exports`** (completed or failed) with JSON **metadata** (manifest version, scope, counts, streaming flag, etc.).
6. An evidence timeline event is recorded (`photo_export_created` / `photo_export_failed`).

---

## Manifest schema version 1

| Field | Value |
|--------|--------|
| `manifest_version` | `1` (integer; bump only on breaking CSV/JSON shape changes) |
| `export_source` | `hairaudit_mobile_surgery_upload` (stable string for downstream parsers) |

**CSV:** Every data row repeats `manifest_version` and `export_source` in the first two columns (row-oriented imports).

**JSON:** Top-level keys include `manifest_version`, `export_source`, then `export`, `case`, `photos`, and `internal`.

Internal / technical fields (case id, storage paths in JSON `internal`, etc.) are **not** duplicated in CSV.

---

## ZIP structure

- **Root folder:** Human-readable case segment + short case id (sanitised, path-safe).
- **Category folders:** Fixed names such as `01-pre-op-donor`, …, `11-other` (see `SURGERY_EXPORT_SLOT_DIRECTORIES` in code).
- **Image files:** Sanitised basenames including slot order, timestamp, and short upload id.
- **Root files:** `manifest.csv`, `manifest.json`.

---

## CSV schema (version 1)

Column order is **stable** (do not reorder without bumping `manifest_version`):

1. `manifest_version`
2. `export_source`
3. `patient_name`
4. `patient_reference`
5. `case_reference`
6. `surgery_date`
7. `clinic_name`
8. `surgeon`
9. `procedure_type`
10. `photo_category`
11. `photo_category_key`
12. `original_filename`
13. `exported_filename`
14. `uploaded_at`
15. `uploaded_by` — **display label** (profile `display_name`, or role label such as Clinic user / Doctor / Reviewer / User; blank if unknown). **Not** a raw UUID.
16. `added_after_review_request`
17. `quality_warning`
18. `width`
19. `height`
20. `original_size_bytes`
21. `compressed_size_bytes`
22. `file_included`
23. `skip_reason`

**Excluded from CSV by design:** raw storage paths, email, phone, address, DOB, insurance/Medicare identifiers.

---

## JSON schema (version 1)

Top-level shape:

```json
{
  "manifest_version": 1,
  "export_source": "hairaudit_mobile_surgery_upload",
  "export": { "generated_at": "...", "export_scope": "...", "selected_slots": [], "photo_count": 0, "included_file_count": 0, "skipped_file_count": 0 },
  "case": { "patient_name": null, "patient_reference": null, "case_reference": "...", "surgery_date": null, "clinic_name": null, "surgeon": null, "procedure_type": null },
  "photos": [ { "uploaded_by_label": "...", "internal": { "upload_id": "...", "storage_path": "...", "uploaded_by_id": "..." } } ],
  "internal": { "case_id": "...", "zip_filename": "...", "downloaded_source_bytes": 0, "note": "..." }
}
```

- **`photos[].uploaded_by_label`:** Same policy as CSV `uploaded_by`.
- **`photos[].internal.uploaded_by_id`:** Optional technical id for audit/debug — **not** for CRM-facing reports.
- **`photos[].internal.storage_path`:** Technical only; CRM teams should prefer CSV + filenames inside the ZIP.

---

## Patient matching rules

- **Patient display name** (for ZIP display name / folder naming / manifest patient fields): loaded from the **patient’s profile** `display_name` when `cases.patient_id` is set; sanitised (no email-like patterns, length limits, filename-safe). Empty when no patient link or no display name.
- **Patient reference:** From `surgery_upload_details.patient_reference` when present (trimmed); used in manifest and case reference resolution.
- **Case reference:** Patient reference if usable, else case title, else short case id fragment — all passed through filename/content sanitisers.

---

## Access / security model

- **Authentication required** — unauthenticated requests receive `401`.
- **Role gate** — only roles allowed by `resolvePhotoPackExportRole` (auditor / doctor / clinic pattern); patients and other roles receive `403`.
- **Case access** — `canAccessCase` must pass; **clinic_profile_id alone is not an access grant**.
- **Patients** cannot export (blocked by role and/or access rules).
- **Export history** is loaded only in contexts that already enforced case access; rows do not grant access to other cases.
- **No public links** — ZIP is attachment-only over an authenticated session.
- **RLS** remains the backstop on tables clients read directly.

---

## Export logging and history

- **`surgery_upload_photo_exports`:** One row per attempt (completed or failed). Metadata JSON includes manifest version, export source, scope, slot keys, patient flags, counts, downloaded source bytes, `streaming_used`, and `zip_bytes` (null when streaming so the final archive size is not precomputed).
- **Evidence timeline:** `photo_export_created` / `photo_export_failed` with sanitised summaries (scope, counts, no storage paths in UI).

---

## Recommended future integration options

1. **Manual ZIP upload into CRM/CMS** — Current model; clinic downloads and imports according to policy.
2. **Secure API pull by an approved CRM/CMS** — Server-to-server, clinic-scoped credential, rate limits, audit log per pull (not implemented in 8C).
3. **Webhook: export available** — Notify an approved system that a new export row exists; partner calls a **separate** authenticated download API (no public URL to the ZIP).
4. **Webhook: surgery upload submitted / evidence accepted** — Operational signals only; still avoid exposing binary URLs without auth.
5. **SFTP / scheduled clinic export** — Batch design below; requires background jobs, size limits, and expiry.
6. **Future native app / device album** — Out of scope for the web portal; would need platform-specific consent and secure transport.

### Why public share links should not be used

Public or long-lived unauthenticated URLs multiply **leakage risk** (forwarding, search indexing, referrer logs) and complicate **revocation** and **audit**. Authenticated, session-scoped download aligns with clinical data handling expectations.

### Privacy risks and mitigations

| Risk | Mitigation |
|------|------------|
| ZIP contains identifiable images | User-facing copy; clinic policy; role-gated export |
| Manifest includes patient name/reference | Required for CRM context; sanitised; no email/phone/DOB in manifest |
| Oversized exports | Photo count cap, estimated bytes, downloaded-bytes cap, 413 with safe message |
| Storage path disclosure | Paths only under JSON `internal`, not in CSV |

### Recommended authentication model for future integrations

- **Clinic-scoped integration token** (rotate, audit, least privilege).
- **OAuth** where the partner supports it and the clinic can consent.
- **Audit log** for every manifest pull / ZIP download (extend `surgery_upload_photo_exports` or a dedicated integration log).

---

## Future batch export (design only — not implemented in 8C)

**Goal:** Export many cases in one job (e.g. for a clinic ETL).

**Suggested filters:**

- Clinic
- Surgery date range
- Surgeon
- Procedure type
- Surgery upload status
- Evidence review status
- Audit intake status
- All or selected photo categories

**Risks and requirements:**

- **Large ZIPs** — Multi-case archives can exceed memory and HTTP timeouts; need chunked ZIPs or object-store staging.
- **Long-running exports** — Must run in a **background worker** (not a single serverless request); progress and cancellation.
- **Privacy** — Same manifest rules; aggregate jobs increase blast radius if mis-scoped.
- **Access boundaries** — Job must enforce the same case access model per case (or explicit clinic-admin scope with legal/policy sign-off).
- **Export audit logs** — One row per case export or per batch with expandable detail JSON.
- **Download expiry** — Time-limited signed download for staged objects **with authentication**, not public URLs.

---

## What must not be included in CRM-facing artifacts

- Phone, email, street address, DOB  
- Medicare / private insurance identifiers  
- Raw storage paths in **CSV**  
- Public unauthenticated download links  

---

## Stage 8C implementation notes (code)

- **Streaming ZIP:** JSZip `generateNodeStream({ streamFiles: true })` + Node `Readable.toWeb` to the HTTP response. Input buffers still exist until the stream completes; see API route header comment.
- **Export history UI:** After a successful client-side fetch + blob download, `router.refresh()` reloads server props so new `surgery_upload_photo_exports` rows appear without a full manual reload.

---

## Suggested next steps (Stage 8D / 9)

- Optional **true** streaming from storage (e.g. pipe download → zip entry without full file buffer) if runtime limits allow.
- **Integration API** + clinic tokens + webhook contracts.
- **Batch export worker** with staging bucket + expiring authenticated download.
