# HA-DONOR-HEALING-1A — Donor Healing Landing Experience and Focused Review Entry

**Date:** 2026-07-30  
**Status:** IMPLEMENTED (gap-fill complete)  
**Verdict:** GREEN  
**Scope:** Turn `/normal-donor-healing-after-fue` into the primary donor-healing acquisition hub and route concerned visitors into a donor-focused **Post-Surgery Audit** entry without a third pathway.

---

## Objective

Convert donor-healing concern into a structured HairAudit Post-Surgery Audit journey while preserving:

- URL `/normal-donor-healing-after-fue`
- SEO intent for “Normal Donor Healing After FUE”
- patient-safe language
- canonical pathway architecture (`post_surgery` only)

## Traffic rationale

In the last 30 days this page received ~491 users / 509 views (~53% of recorded users) — more than 7× graft-failure traffic and 11× homepage traffic. Treat as a primary conversion landing page, not a standard education article.

---

## Architecture decisions

| Decision | Rationale |
|----------|-----------|
| Reuse `post_surgery` pathway only | Avoids duplicate case models, readiness forks, photo-key drift, and fragmented reports |
| CTA → `/request-review?concern=donor_healing&entry_context=donor_healing&recommended_pathway=post_surgery&source_page=…#choose-pathway` | Preserves explicit pathway confirmation |
| Persist `entry_context` on draft `reports.summary` + `patient_audit_v2` at `/api/audit/start` | Survives anon → claim/login and dashboard return without a new cases column |
| Session stash via `hairaudit:pending_entry_context` | Bridges CTA → chooser → auth when URL is stripped |
| Auth return uses `resolveDonorAwareAuthReturnPath` | Generic `/dashboard/patient` next + pending donor context → donor chooser, not bare dashboard |
| Optional `donor_healing_concern` questionnaire section | Save/resume via existing `/api/patient-answers`; answers remain optional |
| Left/right donor keys are **recommended**, not required | Documents rear/left/right emphasis without breaking readiness |
| Bounded orientation contract | Prepares 1B report language; never diagnoses infection/overharvesting/capacity |
| Optional article `cta` + `experience` | Other patient-intent articles unchanged |

**Not a third HairAudit pathway.** Donor healing is entry context / concern focus layered onto Post-Surgery Audit.

Flow:

`Guide → CTA → pathway confirmation → sign-in/anon session → case creation → photos → questions → report`

---

## Entry-context contract

```ts
type HairAuditEntryContext =
  | "donor_healing"              // implemented in 1A
  | "suspected_graft_failure"    // reserved — rejected until wired
  | "low_density"                // reserved — rejected until wired
  | "bright_light_appearance";   // reserved — rejected until wired
```

Validated tokens for donor healing:

| Param | Value |
|-------|--------|
| `entry_context` | `donor_healing` |
| `recommended_pathway` | `post_surgery` |
| `source_page` | `normal-donor-healing-after-fue` |
| `concern` | `donor_healing` (and other PostSurgeryConcern enums) |

Arbitrary URL values are rejected. Sensitive health answers are never placed in the URL.

---

## Pathway confirmation behaviour

Chooser banner when donor entry is active:

> Because your concern relates to healing after a procedure, Post-Surgery Audit is the appropriate review pathway.

Primary action label: **Continue with Post-Surgery Audit**  
Pre-Surgery remains available. No silent pathway force.

---

## Auth-return behaviour

1. CTA / chooser stashes validated pending entry context in `sessionStorage`
2. `DonorEntryContextBinder` re-stashes on `/request-review` when query is donor-valid
3. Login resolves next via `resolveDonorAwareAuthReturnPath`:
   - explicit case path → appends `entry_context` when pending donor context exists
   - generic dashboard next + pending donor → returns to donor-focused chooser
4. Photos/questions login redirects use `withDonorEntryContextQuery`
5. Case creation seeds `entry_context` into report summary / `patient_audit_v2`
6. Unrelated logins without pending donor context keep normal redirect behaviour

**Proof:** unit tests for `resolveDonorAwareAuthReturnPath` + Playwright Journey C (pending session survives login surface; generic dashboard is not the resolved donor path).

---

## Questionnaire persistence

Optional section `donor_healing_concern` on `post_surgery` only:

- primary donor concern enum
- appearance trend
- graft number / punch size (optional)
- hair length band
- comparison-photo availability
- red-flag checklist (`increasing_pain`, `spreading_redness`, `discharge`, `fever`, `persistent_bleeding`, `rapidly_worsening_swelling`)

Red-flag selection shows direct-care warning; does not block documentation. No clinical conclusion generated during intake.

---

## Photo role behaviour

- Required post-surgery readiness keys **unchanged**
- Emphasised donor evidence: rear / left / right
- Left/right added as recommended only
- Guide explains recipient views may still be needed for full readiness; first donor photos document the immediate concern

---

## Patient-safe language review

**Forbidden in patient outputs:**

- normal donor confirmed
- overharvested / overharvesting confirmed
- infection diagnosed / confirmed
- safe remaining graft capacity
- treatment or medication instructions as automated conclusions

**Allowed orientation labels:**

- Appearance broadly compatible with the reported healing stage
- Too early to assess long-term donor uniformity
- Temporary donor shedding may be contributing
- Persistent donor irregularity deserves structured review
- Direct clinical assessment is recommended
- The available photographs are not sufficient to assess this reliably

---

## Analytics event map

```text
page view (donor_guide_viewed)
→ stage selected (donor_stage_selected + stage_group)
→ timeline opened (donor_timeline_stage_opened)
→ CTA clicked (donor_cta_clicked)
→ pathway confirmed (donor_pathway_confirmed)
→ auth started / completed (donor_auth_started / donor_auth_completed)
→ case created (donor_case_created)
→ first photo uploaded (donor_first_photo_uploaded)
→ donor photo set completed (donor_photo_set_completed)
→ questions completed (donor_questions_completed)
→ submitted (donor_case_submitted)
→ report viewed (donor_report_viewed)
```

Safe dimensions only: `entry_context`, `source_page`, `pathway`, `stage_group`, `stage_id`, `stage_route`, non-PHI analytics ids.

**Not logged:** symptoms, health answers, names, emails, free text, image URLs, upload IDs, case IDs in public analytics.

`donorHealingAnalyticsMeta` strips forbidden meta keys (privacy proof covered by unit tests).

---

## Conversion funnel reporting (documentation only)

```text
page view
→ stage selected
→ CTA clicked
→ pathway confirmed
→ authentication completed
→ case created
→ first photo uploaded
→ donor photo set completed
→ questions completed
→ submitted
→ report viewed
```

 derivations:

- CTA CTR = CTA clicks / page views
- Pathway confirmation rate = pathway confirms / CTA clicks
- Auth completion rate = auth completed / auth started (when auth required)
- Case creation rate = cases created / pathway confirms
- First-photo rate = first photo / cases created
- Submission rate = submitted / cases created

Do not hardcode traffic targets into production UI.

---

## Module map (files changed)

| Path | Role |
|------|------|
| `src/lib/patient/donorHealingEntry.ts` | Concerns, entry contexts, orientation, red flags, analytics privacy, path helper |
| `src/lib/patient/patientEntryContext.ts` | Session stash, chooser href, auth-return resolver |
| `src/lib/seo/donorHealingGuideContent.ts` | Timeline (4 areas), comparison cards, photo prep, capability copy |
| `src/components/patient-education/DonorHealingGuideExperience.tsx` | Landing UX |
| `src/components/patient-education/PatientIntentArticlePage.tsx` | Donor experience slot; CTA fallback |
| `src/lib/seo/patient-intent-articles/types.ts` | `PatientIntentArticleCta` + `entryContext` / `recommendedPathway` |
| `src/lib/seo/patient-intent-articles/normal-donor-healing-after-fue.ts` | CTA, FAQs, experience |
| `src/components/marketing/PatientPathwayChooser.tsx` | Donor banner + Continue with Post-Surgery Audit |
| `src/components/patient/DonorEntryContextBinder.tsx` | Query → session stash |
| `src/app/request-review/page.tsx` | Binder + donor query parse |
| `src/app/login/page.tsx` | Donor-aware auth return + auth funnel events |
| `src/components/audit/StartFreeAuditButton.tsx` | `donor_case_created` event name |
| `src/lib/patientAuditForm.ts` | Donor concern + red-flag swelling + comparison photos |
| `src/app/cases/.../photos/page.tsx` | Login next preserves `entry_context` |
| `src/app/cases/.../questions/page.tsx` | Login next preserves `entry_context` |
| `src/app/cases/.../PatientAuditFormClient.tsx` | `donor_questions_completed` |
| `src/lib/preSurgeryIntelligence/graftPlanTotals.ts` + `projection/safety.ts` + `modeContracts.ts` | Build fix: keep `node:crypto` out of client workspace bundle |
| `tests/donorHealing1a.test.ts` | Unit coverage |
| `tests/e2e/hairaudit/donor-healing-1a.spec.ts` | Journeys A–E + screenshots |

---

## Screenshots

| Viewport | Path |
|----------|------|
| Desktop | `tmp/donor-healing-1a-desktop.png` |
| Mobile | `tmp/donor-healing-1a-mobile.png` |

---

## Acceptance checklist

- [x] `/normal-donor-healing-after-fue` unchanged URL
- [x] SEO title/H1 keep primary phrase near the start
- [x] Complete donor-healing landing experience
- [x] Six-stage timeline with four bounded areas each
- [x] Early / later stage choices
- [x] Direct-care safety boundaries
- [x] Main CTA `Check My Donor Healing` (final `Start My Donor Review`)
- [x] Generic article CTAs backward compatible
- [x] Pathway recommended but explicitly confirmed
- [x] Donor context survives auth / case / resume paths
- [x] Not dropped onto generic dashboard when pending donor context exists
- [x] Questionnaire via existing persistence
- [x] Canonical upload keys intact
- [x] No diagnostic / definitive overharvesting language
- [x] Analytics funnel without health data
- [x] Mobile overflow + a11y basics covered in Playwright
- [x] Unit tests, Playwright, lint (changed files), typecheck, production build

---

## Verification results (2026-07-30)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS |
| ESLint on changed donor-healing / login / binder files | PASS |
| `tsx --test tests/donorHealing1a.test.ts` | PASS (20/20) |
| `pnpm build` | PASS |
| Playwright `donor-healing-1a.spec.ts` (`--workers=1`) | PASS (6/6) |
| Screenshots | `tmp/donor-healing-1a-desktop.png`, `tmp/donor-healing-1a-mobile.png` |

---

## Verification commands

```bash
pnpm typecheck
pnpm exec eslint src/lib/patient/donorHealingEntry.ts src/lib/patient/patientEntryContext.ts src/components/patient-education/DonorHealingGuideExperience.tsx src/app/login/page.tsx
pnpm exec tsx --test tests/donorHealing1a.test.ts
pnpm build
pnpm exec playwright test --config=playwright.config.ts tests/e2e/hairaudit/donor-healing-1a.spec.ts --workers=1
```

---

## Known limitations

- Automated clinical scoring / orientation auto-output on patient reports → **delivered in 1B** (`docs/HA-DONOR-HEALING-1B.md`)
- `donor_case_submitted` / `donor_report_viewed` → **delivered in 1B**
- Playwright Journey C proves session + resolver contract; full password/OAuth end-to-end against live credentials is environment-dependent
- Reserved `HairAuditEntryContext` values are validated-reject-only until future concern pages land

---

## Rollback instructions

1. Revert donor-specific article `experience` / `cta` override (page falls back to generic article CTA)
2. Or revert the commit set touching `DonorHealingGuideExperience`, entry-context helpers, chooser banner, and binder
3. Pathway chooser and `/api/audit/start` remain compatible if `entry_context` is simply omitted (backward compatible)
4. Do not remove `post_surgery` readiness keys as part of rollback

---

## Out of scope (later phases)

- **1B** Structured donor intake + report integration hardening / orientation output — **see `docs/HA-DONOR-HEALING-1B.md`**
- **1C** Longitudinal donor photograph comparison — see `docs/HA-DONOR-HEALING-1C.md`
- **1D** Donor heatmaps / zone annotation (content cluster consolidation moved toward **1F**)
- AI future-outcome images, automated extraction counts, capacity calculations
