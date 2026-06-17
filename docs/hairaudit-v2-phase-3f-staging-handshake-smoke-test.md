# HairAudit V2 — Phase 3F Staging Handshake Smoke Test

**Date:** 2026-06-17  
**Scope:** Phase 3E (HairAudit caller) → Phase 3F (FI OS receiver) stub-mode handshake  
**Tester:** Cursor agent (automated probes + local readiness)  
**Overall result:** **PARTIAL PASS** — receivers deployed and probed; full E2E blocked on Vercel env + authenticated upload

---

## Executive Summary

| Check | Result |
|-------|--------|
| HairAudit deploy (`0dd95f6`) | **PASS** — `dpl_AYqDPY2Pncz5jtnW6XYjEvj9GR8H` READY |
| FI OS deploy (`56ac547`) | **PASS** — `dpl_BSMjKqgHqrfa18pjCsbxdNnFUDCE` READY |
| FI OS route reachable | **PASS** — `POST` without token → **401** (not 404) |
| HairAudit route reachable | **PASS** — `GET` → **405**, `POST` without token → **401** |
| Vercel staging env flags | **Unverified / not set** (CLI not authenticated; MCP has no env-list tool) |
| `npm run test:upload-phase3f` (HairAudit local) | **PASS** (23/23) |
| `npm run test:upload-phase3f` (FI OS local) | **PASS** (23/23) |
| Test upload + worker + DB row | **Not run** — requires Vercel env + staging auth |
| `fi_image_intelligence_processed_jobs` completed row | **None** (0 rows) |

Phase 3F-deploy unblocked the missing FI OS receiver. Production now serves `/api/internal/hairaudit/image-classify` on both hosts. The full HairAudit → Inngest → FI OS stub handshake still needs Vercel env configuration and one authenticated staging upload.

---

## Deploy commits

| Repo | Commit | Message | Vercel deployment |
|------|--------|---------|-----------------|
| **hairaudit-v2** | `0dd95f63771cd53a94ae411fcffb8591e9fd7252` | Add FI OS HairAudit image classifier endpoint | `dpl_AYqDPY2Pncz5jtnW6XYjEvj9GR8H` |
| **G-follicleintelligence** | `56ac54770ce538d6c8226d11bfa49de91f928d98` | fix(deploy): repair vercel.json and financial clearance build errors | `dpl_BSMjKqgHqrfa18pjCsbxdNnFUDCE` |

FI OS Phase 3F receiver code landed in `810f1f40961b2dcc45c4b8f5b79b8cf427911370` (bundled with cron auth work). Deploy was blocked until `56ac547` fixed invalid duplicate `vercel.json` and a TypeScript build error in `financialClearance.server.ts`.

---

## Staging hosts tested

| Role | Host | Endpoint probe |
|------|------|----------------|
| FI OS (receiver) | `https://www.follicleintelligence.ai` | `GET /api/internal/hairaudit/image-classify` → **405**; `POST` (no auth) → **401** |
| HairAudit (caller + loopback receiver) | `https://www.hairaudit.com` | Route present on `0dd95f6` deployment |
| HairAudit preview | `https://hairaudit-v2-rmvyo16tj-fi-ai-ef8ee84f.vercel.app` | `GET` → **405** |

**Contract URL for HairAudit caller:**

```env
FI_OS_IMAGE_CLASSIFIER_URL=https://www.follicleintelligence.ai/api/internal/hairaudit/image-classify
```

---

## Environment variables (required — not confirmed set)

### FI OS (`g-follicleintelligence`)

```env
HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN=<shared-secret-min-16-chars>
HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub
```

### HairAudit (`hairaudit-v2`)

```env
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=true
HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=true
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os
FI_OS_IMAGE_CLASSIFIER_URL=https://www.follicleintelligence.ai/api/internal/hairaudit/image-classify
FI_OS_IMAGE_CLASSIFIER_TOKEN=<same-as-HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN>
```

**Status:** Could not read or write Vercel env from this environment (`vercel whoami` → no credentials). Values above are **documented only** — confirm in Vercel dashboard for both projects, then redeploy if needed.

**Indirect evidence:** `POST` without bearer token returns **401** on FI OS (auth layer active; token env may still be unset — both missing token and invalid token return 401).

---

## Readiness checks

### HairAudit: `npm run check:hairaudit-events`

| Environment | Result |
|-------------|--------|
| Local (default env) | **PASS** — FI flags off, `dry_run` provider |
| Local (simulated staging flags) | **WARN** — expected when FI pipeline enabled |

### Phase 3F tests

| Repo | Command | Result |
|------|---------|--------|
| hairaudit-v2 | `npm run test:upload-phase3f` | **PASS** 23/23 |
| G-follicleintelligence | `npm run test:upload-phase3f` | **PASS** 23/23 |
| G-follicleintelligence | `npm run typecheck` | Pre-existing errors in unrelated financial-os files; **`npm run build` PASS** after deploy fix |

---

## Endpoint contract probe (deployed, redacted)

```http
POST https://www.follicleintelligence.ai/api/internal/hairaudit/image-classify
Content-Type: application/json

{"source_system":"hairaudit","idempotency_key":"...","source_case_id":"...","source_upload_id":"...","canonical_photo_category":"patient_current_front"}
```

**Without `Authorization` header:** `401` `{ "error": "Unauthorized" }` — confirms route deployed and auth gate active.

**With valid token + `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub`:** expected `200` with `classifier_version: "fi-os-stub-v1"` (not verified — env not set from this session).

---

## End-to-end upload smoke (staging)

**Not executed** — blockers:

1. Vercel env vars not confirmed/set for FI pipeline flags and shared classifier token.
2. No authenticated staging session for patient photo upload.
3. Zero rows in `fi_image_intelligence_processed_jobs`.

| Step | Status |
|------|--------|
| Upload succeeds | **Skipped** |
| `upload.created` / Inngest enqueue | **Unknown** |
| Worker runs + image fetch | **Unknown** |
| FI OS stub classify | **Route ready**; stub **not E2E verified** |
| `fi_image_intelligence_processed_jobs` completed | **FAIL** — 0 rows |
| `result.model_provider = fi_os` | **N/A** |
| `classifier_version = fi-os-stub-v1` | **N/A** |
| No signed URLs/tokens in responses | **PASS** (unit tests) |

### DB query (HairAudit Supabase `vbzjkqhvzfunahmlxevb`)

```sql
SELECT id, case_id, upload_id, status,
       result->>'model_provider' AS model_provider,
       result->>'model_version' AS model_version,
       processed_at
FROM fi_image_intelligence_processed_jobs
ORDER BY created_at DESC
LIMIT 10;
```

**Result:** `[]`

---

## Result sample (local stub — redacted)

From `npm run test:upload-phase3f` (not from staging):

```json
{
  "category": "patient_current_front",
  "canonical_photo_category": "patient_current_front",
  "confidence": 0.62,
  "quality_status": "not_evaluated",
  "protocol_status": "not_evaluated",
  "classifier_version": "fi-os-stub-v1",
  "notes": "Stub classification only"
}
```

No `signed_url`, `storage_path`, `token`, or bearer material in response (verified by tests).

---

## Issues remaining

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | Vercel env vars not set/verified — full handshake cannot run |
| 2 | **High** | No authenticated staging upload performed |
| 3 | **High** | Zero `fi_image_intelligence_processed_jobs` rows |
| 4 | **Info** | No separate staging Vercel projects; production URLs used as targets |
| 5 | **Resolved** | FI OS deploy failures from duplicate `vercel.json` + TS build error (`56ac547`) |

---

## Rollback flags (HairAudit)

```env
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=dry_run
HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=false
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=false
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=false
```

FI OS side: unset `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` or remove route deployment.

---

## Recommended next steps

1. **Set Vercel env** on `g-follicleintelligence` and `hairaudit-v2` (values in section above); use the same 32+ char shared secret for both token vars.
2. **Redeploy** both projects after env changes (or trigger redeploy from dashboard).
3. **Probe stub response:** `curl -X POST` with `Authorization: Bearer <token>` and `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub` on FI OS — expect `200` + `fi-os-stub-v1`.
4. **Re-smoke upload:** one patient photo on HairAudit staging; confirm Inngest run and query `fi_image_intelligence_processed_jobs`.
5. **Phase 3G:** wire real `classifyClinicalHairImageFromModelUrl` (no ML in Phase 3F scope).

---

## Sign-off

| Item | Value |
|------|-------|
| **Smoke result** | **PARTIAL PASS** (deploy + route probes pass; E2E fail) |
| **FI endpoint URL** | `https://www.follicleintelligence.ai/api/internal/hairaudit/image-classify` |
| **HairAudit commit** | `0dd95f6` |
| **FI OS commit** | `56ac547` |
| **Next action** | Set Vercel env vars, then re-run upload smoke |
