# Stage 1C — Report access and download hardening

## Principles

1. **Session required** for user-facing PDF download and signed URL routes (except intentionally public demo content and **render-token** internal print paths).
2. **Report → case → `canAccessCase`** before any storage read or signed URL for report PDF keys.
3. **Storage namespace**: report PDF paths must belong to the authorized case (`storagePathBelongsToReportCase`). Evidence image keys use `storagePathBelongsToCase` under `cases/{caseId}/…`.
4. **Service role** (`tryCreateSupabaseAdminClient` / `createSupabaseAdminClient`) is only used **after** authorization, consistent with Stage 1A uploads.

## Shared module

`src/lib/reports/reportAccess.ts`

- `resolveReportCaseId(report)`
- `storagePathBelongsToReportCase(caseId, pdfPath)` — traversal-safe + `extractCaseIdFromPdfPath` alignment
- `loadAuthorizedReportPdfDownloadContext({ userId, reportId, supabaseAuth })` — report row + `requireCaseAccess` + path validation + returns storage handle for streaming
- `requireReportAccessByCaseId` — alias of `requireCaseAccess`
- `requireReportAccessByReportId` / `requireReportAccess` — metadata-only access check (no blob)

## Routes

| Route | Auth | Notes |
|-------|------|--------|
| `GET /api/reports/[reportId]/download` | Session | Uses `loadAuthorizedReportPdfDownloadContext`; streams PDF. |
| `GET /api/reports/download?reportId=` | Session | **Fixed:** previously mis-implemented; now matches `[reportId]/download` behaviour (legacy query form preserved). |
| `GET /api/reports/signed-url?path=` | Session | `requireUser` + `requireCaseAccess` + `storagePathBelongsToReportCase`; alt `cases/{id}/reports/v{n}.pdf` only if it still matches the case. |
| `GET /api/print/report` | **Render token only** | Internal Playwright / PDF pipeline; no browser session. Token binds `caseId` + `auditMode`. |
| `GET /api/print/legacy-report` | Render token **or** session | Session path uses **`canAccessCase`** (replaces ad-hoc participant list + metadata-only auditor). Upload signing gated with `storagePathBelongsToCase`. |
| `GET /api/reports/demo-pdf` | Public | Demo sample only (unchanged). |

## Report HTML viewer

`src/app/reports/[caseId]/html/page.tsx` — session branch uses **`canAccessCase`**; signed upload URLs only when `storagePathBelongsToCase`.

## Elite print pipeline

`src/lib/pdf/elitePrintPhotoSignedUrlPipeline.ts` — signs only paths under the print `caseId` namespace.

## Response shapes

- JSON errors for API download/signed-url unchanged where possible (`{ error }`, same status codes).
- Legacy print HTML error pages unchanged in structure.
