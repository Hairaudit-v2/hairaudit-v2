# Core patient audit flow — regression spine

Lightweight checklist for manual QA and future E2E automation. **No schema or report pipeline changes** are implied by this document.

## Preconditions

- Authenticated patient (or dev session with patient role).
- Environment variables for Supabase, storage, and (if applicable) Inngest/job workers match the target deployment.

## Spine (happy path)

1. **Create case** — `POST /api/cases/create` (canonical) or legacy `POST /cases/create`; expect `{ ok: true, caseId }` and navigation to `/cases/{caseId}` from the dashboard button.
2. **Upload patient photos** — patient photo slots via the case upload APIs; thumbnails load via `GET /api/uploads/signed-url?path=…` (optional `caseId` query for defense-in-depth when the client has it).
3. **Upload doctor/clinic photos** (when applicable) — same signed-url/list gates; paths under `cases/{caseId}/…` or `audit_photos/{caseId}/…`.
4. **Submit case** — patient submission path reaches submitted state (existing submit API / UI flow).
5. **AI audit / job queued** — background job or Inngest function enqueued (verify logs or job dashboard for the environment).
6. **Report version created** — report row / version reflects completed audit (per product rules; do not change generation behavior in guardrail work).
7. **Report viewed / downloaded** — PDF or HTML report access paths still work; `GET /api/reports/signed-url` remains the dedicated report-PDF signing route where used.
8. **Auditor rerun / override** — auditor tools can re-run or override where implemented (e.g. GII / overrides); signed URLs for evidence still respect `requireCaseAccess`.

## Automated guardrails (source-level)

| Concern | Location |
|--------|-----------|
| No duplicate `route1.ts`-style modules under `src/app/api` or `src/app/cases` | `tests/stage3cGuardrails.test.ts` |
| Case creation routes share one POST handler | `src/lib/cases/createAuditCasePostHandler.server.ts` + contract test in `tests/stage3cGuardrails.test.ts` |
| Upload path gates / list auth | `pnpm test:upload-auth` |

## Related docs

- `docs/stage1b-case-creation-consolidation.md` — `createAuditCase` ownership.
- `docs/stage3b-upload-security.md` — signed-url / list hardening.
