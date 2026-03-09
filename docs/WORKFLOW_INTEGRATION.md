# HairAudit Workflow Integration Summary

This document describes how the following features are wired together and their state transitions.

## 1. Report finalization (Inngest)

When an audit report is successfully inserted:

- **auditor_review_eligibility**: `computeAuditorReviewEligibility(finalAiScore)` → `eligible_low_score` (<60), `eligible_high_score` (>90), `not_eligible` (60–90).
- **provisional_status** (for ≥90): `computeProvisionalFromScore(finalAiScore)` → `pending_validation` when score ≥90, else `none`.
- **counts_for_awards**: Same helper → `false` when score ≥90 (provisional), `true` otherwise. Failed report insert sets `counts_for_awards: false`, `provisional_status: 'none'`, `auditor_review_eligibility: 'not_eligible'`.

**Files:** `src/lib/inngest/functions.ts` (report insert step, failed-report insert step), `src/lib/auditor/eligibility.ts`.

---

## 2. Clinic award computation (transparency program)

- Only reports with **counts_for_awards !== false** contribute to validated case count, average score, benchmark-eligible count, and tier.
- **Provisional pending** (pending_validation, ≥90): counted in `provisional_high_score_count` but excluded from `validatedCaseCount` and tier metrics.
- **Rejected** (provisional_status = 'rejected'): have `counts_for_awards = false`, so excluded from all award metrics.

**Files:** `src/lib/transparency/program.ts` (refreshClinicTransparencyMetrics, refreshDoctorTransparencyMetrics).

---

## 3. Validated high-score weight

- **award_contribution_weight** on reports: set at insert (Inngest) and when auditor approves or evidence/consistency validation runs. Validated high-score (≥90) gets weight **1.5**; benchmark-eligible adds **+0.25**.
- Stored for future leaderboard/tier weighting; tier logic currently uses validated case count and average score (not weighted sum).

**Files:** `src/lib/auditor/eligibility.ts` (computeAwardContributionWeight), `src/lib/inngest/functions.ts`, `src/app/api/auditor/report-status/route.ts`, `src/lib/transparency/program.ts`.

---

## 4. Manual auditor review tools (conditional)

- **UI:** Case page shows `AuditorReviewPanel` only when `showAuditorReview = isAuditor && latestReport && isAuditorReviewAvailable(auditorReviewEligibility)`. Otherwise shows read-only domain accordion and, for auditors, "Unlock auditor review".
- **API:** POST/DELETE on score-overrides and POST on section-feedback require `isEligibleForManualReview(report.auditor_review_eligibility)` (or report not found); otherwise 403. Unlock sets `auditor_review_eligibility = 'eligible_manual_unlock'`.

**Files:** `src/app/cases/[caseId]/page.tsx`, `src/app/cases/[caseId]/UnlockAuditorReviewButton.tsx`, `src/app/api/auditor/score-overrides/route.ts`, `src/app/api/auditor/section-feedback/route.ts`, `src/app/api/auditor/unlock-review/route.ts`.

---

## 5. Final report: overrides and AI preservation

- Report HTML loads overrides and applies them in memory via `applyAuditorOverridesToSummary`. Stored report summary is not modified; AI values remain in DB. Override rows keep `ai_score`, `manual_score`, `delta_score`.
- Only **report-visible** overrides/feedback (visibility_scope = `included_in_report`) drive "Auditor change summary" and per-domain "Auditor notes" in the final HTML/PDF.

**Files:** `src/app/reports/[caseId]/html/page.tsx`, `src/lib/auditor/applyOverrides.ts`, `src/lib/auditor/visibility.ts`.

---

## 6. Low-score safeguard (pause progression)

- `shouldPauseProgression(lowScoreCaseCount)` returns true when lowScoreCaseCount ≥ `AWARD_RULES.lowScorePauseThreshold` (2).
- In `determineAwardTier`, when `metrics.awardProgressionPaused` is true, no tier above VERIFIED is granted. Clinic/doctor profile stores `award_progression_paused` and dashboard shows "Progression paused".

**Files:** `src/lib/transparency/awardRules.ts`, `src/lib/transparency/program.ts`, `src/components/dashboard/ClinicTransparencyProgressPanel.tsx`.

---

## 7. Dashboards (clinic)

- **Clinic dashboard** shows: current tier, next tier, paused state, participation rate, total audited, doctor-contributed, validated award-counting, provisional (awaiting validation), benchmark-eligible validated, avg validated score, documentation integrity, **next milestone** (from `getNextMilestoneFromProfile`).

**Files:** `src/app/dashboard/clinic/page.tsx`, `src/components/dashboard/ClinicTransparencyProgressPanel.tsx`, `src/lib/transparency/awardRules.ts`.

---

## 8. Admin extreme-score queues

- **High-score queue:** reports with `provisional_status = 'pending_validation'`, `counts_for_awards = false`. Actions: Validate by auditor (→ validated_by_auditor, counts_for_awards true), Reject (→ provisional_status rejected, counts_for_awards false).
- **Low-score queue:** reports with `auditor_review_eligibility = 'eligible_low_score'`, status in (not_requested, available, in_review). Actions: Start auditor review (→ in_review), Mark skipped (→ skipped).

**Files:** `src/app/admin/extreme-score-review/page.tsx`, `src/app/admin/extreme-score-review/ExtremeScoreReviewClient.tsx`, `src/app/api/auditor/report-status/route.ts`, `src/lib/admin/extremeScoreQueue.ts`.

---

## 9. Note visibility (no leakage)

- **Report (patient-facing):** only overrides/feedback with `visibility_scope = 'included_in_report'`.
- **Clinic-facing:** only `included_in_clinic_feedback` (e.g. GET `/api/auditor/clinic-feedback`).
- **Internal/auditor:** full list from score-overrides and section-feedback APIs (no visibility filter). Internal-only notes never returned by report or clinic paths.

**Files:** `src/lib/auditor/visibility.ts`, `src/app/reports/[caseId]/html/page.tsx`, `src/app/api/auditor/clinic-feedback/route.ts`.

---

## Workflow state transitions (summary)

| Event | auditor_review_eligibility | provisional_status | counts_for_awards |
|-------|----------------------------|--------------------|-------------------|
| Report insert, score <60 | eligible_low_score | none | true |
| Report insert, 60≤score≤90 | not_eligible | none | true |
| Report insert, score >90 | eligible_high_score | pending_validation | false |
| Report insert (failed) | not_eligible | none | false |
| Auditor approves high-score | (unchanged) | validated_by_auditor | true |
| Reject provisional | (unchanged) | rejected | false |
| Evidence/consistency validation | (unchanged) | validated_by_evidence / validated_by_consistency | true |
| Admin unlock review | eligible_manual_unlock | (unchanged) | (unchanged) |

| Low-score queue action | auditor_review_status |
|------------------------|------------------------|
| Start review | in_review |
| Mark skipped | skipped |
