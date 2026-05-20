# Training case faculty corrections

Faculty/admin correction workflow for IIOHR academy training cases. Additive feature; does not change `training_case_assessments` or `training_case_reviews` behaviour.

## Routes

| Route | Purpose |
|-------|---------|
| `/academy/cases/[caseId]/edit` | Correction editor (staff only) |
| `GET /api/academy/cases/[caseId]/corrections` | Correction history |
| `PATCH .../corrections/details` | Case fields |
| `PATCH .../corrections/metrics` | Metrics + derived recalculation |
| `POST .../corrections/archive` | Archive or void |
| `POST .../corrections/restore` | Restore to draft |
| `POST .../corrections/delete` | Soft delete |
| `DELETE .../corrections/delete` | Hard delete (academy_admin, no reviews/assessments) |
| `PATCH/DELETE /api/academy/uploads/[uploadId]/corrections` | Category change / soft-delete upload |

## Database

Migration: `supabase/migrations/20260520120001_training_case_corrections.sql`

- `training_case_corrections` audit table
- `training_cases`: `voided` status, archive/delete metadata
- `training_case_uploads`: `deleted_at`, `deleted_by`, staff UPDATE policy

## Manual QA

1. Apply migration locally (`supabase db push` or equivalent).
2. Sign in as academy staff; open a training case → **Correct case data**.
3. Change surgery date + reason → save → verify correction history row.
4. Change graft counts/times → save → verify derived metrics on case detail.
5. Re-categorise an upload → verify type in photos panel.
6. Delete upload with reason → verify removed from UI, row soft-deleted, audit logged.
7. Archive/void → restore → soft delete as staff; hard delete only as admin on case with no reviews.
8. Confirm trainee cannot open `/edit` or see correction history.
9. Confirm existing review at `/academy/training-cases/[id]/review` still works.

## Tests

`npm run test:training-corrections`
