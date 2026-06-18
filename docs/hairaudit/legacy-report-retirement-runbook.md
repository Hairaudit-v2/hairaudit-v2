# HA-UPLOAD-3B — Legacy Report Retirement Runbook

**Phase:** HA-UPLOAD-3B (30-day traffic review)  
**Status:** Observability active — route not retired  
**Owner:** _@platform-oncall / report-pipeline owner_  
**Review start:** _YYYY-MM-DD_  
**Decision date:** _YYYY-MM-DD_ (30 days after review start)  
**Related code:** `src/lib/reports/legacyReportUsageLog.ts`, `src/app/api/print/legacy-report/route.ts`

---

## Purpose

`GET /api/print/legacy-report` is the **legacy HTML print path** (rubric recompute via `scoreAudit`, older layout). Production PDF generation already targets the **elite print route** (`/api/print/report` via `buildPdfUrl` in `src/lib/reports/pdfUrl.ts` and `renderPdfInternal.ts`).

Phase HA-UPLOAD-3B added **temporary retirement instrumentation** so operators can answer, without reading report bodies in logs:

- Is anything still calling the legacy route in production?
- Which auth path is used (session vs render token)?
- Are successes/errors clustered by outcome?

Use this runbook during a **30-day observation window** before removing or hard-disabling the route.

---

## Where the route lives

| Item | Location |
|------|----------|
| HTTP route | `GET /api/print/legacy-report?caseId=...&auditMode=...&token=...` |
| Handler | `src/app/api/print/legacy-report/route.ts` |
| Usage logger | `src/lib/reports/legacyReportUsageLog.ts` |
| Log tag | `[legacy-report-usage]` |
| Tests (log contract) | `tests/legacyReportUsageLog.test.ts` |

**Primary replacement:** `GET /api/print/report` — `src/app/api/print/report/route.ts` (elite HTML for Playwright / internal PDF pipeline; render-token auth).

| Consumer | Route used today |
|----------|----------------|
| Internal PDF render (`renderPdfInternal`, `generateReportPdf`) | `/api/print/report` |
| Legacy browser/session HTML preview | `/api/print/legacy-report` (if still linked anywhere) |

See also: `docs/stage1c-report-access-hardening.md` (auth matrix for print routes).

---

## Log search

### Tag

Search production logs for:

```text
[legacy-report-usage]
```

### Structured fields (every `console.info` line)

Emitted by `logLegacyReportUsage` / `createLegacyReportUsageTracker`:

| Field | Meaning |
|-------|---------|
| `requestId` | Per-request UUID (correlate with `render_error` only) |
| `timestamp` | ISO-8601 |
| `hasCaseId` | Query included a non-empty `caseId` |
| `requestedAuditMode` | `patient` / `full` from query (normalized) |
| `auditMode` | Resolved mode after access checks |
| `authPath` | `session`, `token`, or `none` |
| `outcome` | See outcomes table below |
| `status` | HTTP status returned |
| `durationMs` | Handler wall time |
| `reviewAreaCount` | On `success` only — count, not text |
| `hasReportVersion` | On `success` only — boolean |

**Outcomes:** `success`, `missing_case_id`, `invalid_token`, `unauthorized`, `case_not_found`, `forbidden`, `error`.

**Exception path:** `console.error("[legacy-report-usage] render_error", { requestId, error })` — use `requestId` to pair with the last structured line; do not paste full `error` objects into tickets if they might contain request context.

### Example queries

**Vercel (production / preview):**

```bash
vercel logs <deployment-url-or-alias> --since 30d | grep '\[legacy-report-usage\]'
```

In the Vercel dashboard: Logs → filter message contains `legacy-report-usage`.

**Count successes (rough shell parse):**

```bash
vercel logs <alias> --since 30d | grep '\[legacy-report-usage\]' | grep -c '"outcome":"success"'
```

**Local dev (next server stdout):**

```bash
npm run dev
# trigger legacy URL in browser, then in another terminal:
# (PowerShell)
Select-String -Path .\logs\*.log -Pattern 'legacy-report-usage'   # if you tee dev output to a file
```

**Verify log contract in CI locally:**

```bash
npx tsx --test tests/legacyReportUsageLog.test.ts
```

### Safe vs unsafe in logs

| Safe to aggregate / share in tickets | Do **not** log or paste from other systems |
|--------------------------------------|---------------------------------------------|
| `outcome`, `status`, `authPath`, `auditMode`, counts, `durationMs`, `requestId` | `caseId`, patient/user identifiers, report `summary`, findings text, photo URLs, tokens |
| Hourly/daily hit counts, outcome breakdown | Full HTML response bodies, query strings with `token=` |
| `reviewAreaCount`, `hasReportVersion` | Storage paths tied to identifiable cases in public channels |

The instrumentation module explicitly avoids report content and patient identifiers (`legacyReportUsageLog.ts` header comment). If you need case-level debugging, use **authorized app tools** or **session-based reproduction** in staging — not production log export of query params.

---

## 30-day review checklist

Complete once near **review start**, then again on **decision date**.

- [ ] Confirm `[legacy-report-usage]` lines appear in **production** log drain (smoke: one staged hit in preview if prod is quiet).
- [ ] Record review start date and owner in this doc (placeholders above).
- [ ] Pull **30-day** (or rolling window) counts: total hits, `outcome=success`, by `authPath`.
- [ ] Break down non-success outcomes (`unauthorized`, `invalid_token`, etc.) — noise vs real callers.
- [ ] Search repo and docs for `legacy-report` / `/api/print/legacy-report` links (UI, scripts, old bookmarks).
- [ ] Confirm PDF pipeline jobs use `/api/print/report` only (`pdfUrl.ts`, `renderPdfInternal.ts`, `generateReportPdf.ts`).
- [ ] Check for **token-based** automation still pointed at legacy URL (cron, harness, external integrators).
- [ ] If any production `authPath=token` successes: identify job owner before removal.
- [ ] If any production `authPath=session` successes: identify UI entry point (case page, HTML viewer, email link).
- [ ] Document decision in this file (section below) and notify stakeholders.

---

## Decision table

| Observation (30-day window) | Recommended action |
|-----------------------------|-------------------|
| **Zero** `outcome=success` lines (only errors or no hits) | Safe to **retire** route: return **410 Gone** or remove handler; update `docs/architecture-map.md` and `docs/auditos-stage4a-pipeline-map.md`. |
| Hits only from **manual / debug** (known IPs, staging, local dev, single engineer) | **Retire** with docs update; no redirect required if no prod dependency. |
| **Production traffic** with `outcome=success` | **Do not delete.** First **redirect or internal rewrite** to elite route (`/api/print/report`) for equivalent `caseId` + `auditMode` + token/session rules; keep legacy route as thin shim for one release if needed. |
| **Token-based jobs** (`authPath=token`) with successes | **Migrate jobs** to `buildPdfUrl` / `/api/print/report` before removal; verify Playwright/PDF render in staging. |
| Mixed session + token traffic | Split migration: UI → elite preview or signed PDF download; jobs → `/api/print/report`. Re-run 30-day review after shim. |

**Decision record (fill on decision date):**

| Field | Value |
|-------|-------|
| Decision | _retire / shim / extend review_ |
| Success hits (30d) | _n_ |
| authPath breakdown | _session: n, token: n, none: n_ |
| Action owner | _name_ |
| Target deploy | _YYYY-MM-DD_ |

---

## Final retirement checklist

Execute only after decision table allows removal (or after successful shim + zero legacy successes).

- [ ] Remove or 410 `src/app/api/print/legacy-report/route.ts` (and route registration if applicable).
- [ ] Remove `legacyReportUsageLog` instrumentation if no longer needed.
- [ ] Delete or update tests referencing legacy route (`tests/uploadPhase2d.test.ts` infra list, any harness URLs).
- [ ] Update architecture docs (`docs/architecture-map.md`, `docs/auditos-stage4a-pipeline-map.md`, `docs/stage1c-report-access-hardening.md`).
- [ ] Grep repo for `legacy-report` / `print/legacy-report` — zero unexpected references.
- [ ] Confirm `npm run test:upload-phase2d` (and full test suite if touching code) passes.
- [ ] Monitor `/api/print/report` error rate for 7 days post-removal.
- [ ] Archive this runbook with final counts appended below.

---

## Appendix — reference links

- Elite print URL builder: `src/lib/reports/pdfUrl.ts`
- PDF render guard (elite only): `src/lib/pdf/generateReportPdf.ts`
- Report access hardening: `docs/stage1c-report-access-hardening.md`
