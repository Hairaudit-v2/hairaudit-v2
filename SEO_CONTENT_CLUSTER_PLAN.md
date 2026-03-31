# SEO content cluster plan — patient intent & anti-cannibalization

This document maps **target keywords** to **URL roles**, **internal linking**, and **cannibalization controls** after the second SEO layer. All pages use existing templates: `IssueEducationPage` (issue slugs), `PatientIntentArticlePage` + article modules under `src/lib/seo/patient-intent-articles/`, plus core marketing routes.

## Page-role map (site architecture)

| URL / pattern | Primary role | Owns (intent) | Should not compete for |
|---------------|--------------|---------------|-------------------------|
| `/` | Brand + discovery | What HairAudit is; independence; link-out to guides/methodology | Transactional “submit” long-tail (point to `/request-review`) |
| `/request-review` | Transactional conversion | Start audit; upload; what you get after submit | Educational “what is wrong with my transplant” (point to guides hub + issues) |
| `/methodology` | Trust / framework | How audits are done; domains; AI + clinical review; limits | Sample report visuals; FAQ objections |
| `/sample-report`, `/demo-report` | Proof / output | Report structure; example output; interactive demo | Deep clinical education clusters |
| `/faq` | Support / objections | Process, privacy, confidence, pathways | Long-form patient education (point to `/hair-transplant-problems`) |
| `/hair-transplant-problems` | Hub | Thematic index of guides + issues | Specific problem keywords (child pages own those) |
| Issue URLs (`/hair-transplant-too-thin`, etc.) | Concise problem landing | One intent per URL; short overview + CTA | Long-head explanations (link to guides) |
| Guide URLs (`/hair-transplant-density-too-low`, etc.) | Deep education | Mechanism, nuance, photo discipline | Conversion-only copy (CTA secondary) |

**Schema:** Issue and guide templates already emit FAQ / Article JSON-LD where configured (`MedicalProcedureFaqSchema`, `PatientIntentArticlePage` Article block). New guides follow the same article schema pattern.

---

## Cluster rows (focus topics + adjacent URLs)

### 1. Donor overharvesting after FUE

| Field | Value |
|--------|--------|
| Target keyword(s) | donor overharvesting after FUE; FUE donor thinning |
| Search intent | Problem awareness; “is my donor damaged?” |
| Recommended URL (primary) | `/hair-transplant-donor-overharvested` (issue) |
| Page type | Issue landing |
| Parent links | `/hair-transplant-problems`, `/overharvested-donor-area` |
| Child / sibling links | `/normal-donor-healing-after-fue`, `/shock-loss-vs-graft-failure`, `/request-review` |
| Cannibalization notes | Long-form **pattern** education: `/overharvested-donor-area`. **Normal healing** (not overharvest): `/normal-donor-healing-after-fue`. Issue page intro + Related guides point to both. |

### 2. Low density after hair transplant

| Field | Value |
|--------|--------|
| Target keyword(s) | low density after hair transplant; transplant still thin |
| Search intent | Diagnostic framing; timeline vs quality |
| Recommended URL (primary) | `/hair-transplant-density-too-low` (guide) |
| Page type | Long-form guide |
| Parent links | `/hair-transplant-problems`, `/hair-transplant-too-thin` |
| Child / sibling links | `/when-is-a-hair-transplant-final`, `/shock-loss-vs-graft-failure`, `/hair-transplant-too-thin` |
| Cannibalization notes | Issue `/hair-transplant-too-thin` = **short** landing; guide owns **depth**. Titles/meta differentiated; reciprocal internal links. |

### 3. Bad hairline design after transplant

| Field | Value |
|--------|--------|
| Target keyword(s) | bad hairline after hair transplant; unnatural hairline |
| Search intent | Design / naturalness concern |
| Recommended URL (primary) | `/bad-hair-transplant-hairline` (issue) + `/unnatural-hairline-after-hair-transplant` (guide) |
| Page type | Issue + guide (stacked intent) |
| Parent links | `/hair-transplant-problems`, `/what-makes-a-hair-transplant-look-natural` |
| Child / sibling links | `/temple-work-and-frontal-framing`, `/request-review` |
| Cannibalization notes | Issue renamed toward **concise hairline evaluation**; guide owns **pattern detail**. Cross-linked in intros. |

### 4. Hair transplant second opinion

| Field | Value |
|--------|--------|
| Target keyword(s) | hair transplant second opinion; independent second opinion |
| Search intent | Conceptual; trust vs clinic self-assessment |
| Recommended URL (primary) | `/hair-transplant-second-opinion-vs-clinic-opinion` |
| Page type | Long-form guide |
| Parent links | `/hair-transplant-problems`, `/methodology` |
| Child / sibling links | `/request-review`, `/what-an-independent-hair-transplant-audit-can-and-cannot-do`, `/should-you-trust-a-clinic-assessment-of-its-own-work` |
| Cannibalization notes | Meta description stresses **conceptual** framing; transactional intent pushed to `/request-review`. Homepage no longer duplicates “submit” meta. |

### 5. Normal donor healing after FUE

| Field | Value |
|--------|--------|
| Target keyword(s) | normal FUE donor healing; donor healing timeline |
| Search intent | Reassurance + when to escalate |
| Recommended URL (primary) | `/normal-donor-healing-after-fue` (new guide) |
| Page type | Long-form guide |
| Parent links | `/hair-transplant-problems` (donor theme), `/overharvested-donor-area` |
| Child / sibling links | `/hair-transplant-donor-overharvested`, `/shock-loss-vs-graft-failure` |
| Cannibalization notes | **Does not** target “overharvested” as primary; links out to overharvest content when pattern is persistent. |

### 6. Repair vs wait after poor growth

| Field | Value |
|--------|--------|
| Target keyword(s) | repair or wait hair transplant; second surgery too soon |
| Search intent | Decision sequencing |
| Recommended URL (primary) | `/repair-vs-wait-after-poor-hair-transplant-growth` (new guide) |
| Page type | Long-form guide |
| Parent links | `/thinking-about-a-second-hair-transplant`, `/when-is-a-hair-transplant-final` |
| Child / sibling links | `/shock-loss-vs-graft-failure`, `/when-is-hair-transplant-growth-delay-normal-vs-concerning`, `/hair-transplant-not-growing` |
| Cannibalization notes | Second-transplant guide stays **donor/planning**-heavy; this guide owns **wait vs act** framing. |

### 7. Growth delay normal vs concerning

| Field | Value |
|--------|--------|
| Target keyword(s) | hair transplant growth delay; slow growth normal |
| Search intent | Timeline anxiety; risk framing |
| Recommended URL (primary) | `/when-is-hair-transplant-growth-delay-normal-vs-concerning` (new guide) |
| Page type | Long-form guide |
| Parent links | `/shock-loss-vs-graft-failure`, `/is-my-hair-transplant-normal` |
| Child / sibling links | `/hair-transplant-not-growing`, `/hair-transplant-graft-failure`, `/repair-vs-wait-after-poor-hair-transplant-growth` |
| Cannibalization notes | **Shock loss** guide owns shedding vs failure **definitions**; this guide owns **milestone-style delay** language. Issue `/hair-transplant-not-growing` stays short. |

### 8. Signs transplant may have failed

| Field | Value |
|--------|--------|
| Target keyword(s) | signs hair transplant failed; graft failure signs |
| Search intent | Survival / yield worry |
| Recommended URL (primary) | `/hair-transplant-graft-failure` (issue) |
| Page type | Issue landing |
| Parent links | `/shock-loss-vs-graft-failure`, `/bad-hair-transplant-signs` |
| Child / sibling links | `/hair-transplant-graft-failure-what-photos-can-and-cannot-show`, `/repair-vs-wait-after-poor-hair-transplant-growth` |
| Cannibalization notes | **`/bad-hair-transplant-signs`** = visible **pattern map** (design/donor/density). **Graft failure issue** = survival/timing. **Photos guide** retitled toward **evidence limits** (not duplicate “signs” title stack). |

---

## Implementation touchpoints (for maintainers)

- **Issue copy + related links:** `src/lib/patientEducationIssues.ts`; optional `relatedGuideSlugs` rendered by `IssueEducationPage` via `src/lib/seo/resolvePatientGuideLink.ts`.
- **Issue intros with inline links:** `PatientEducationLinkedText` (`src/components/patient-education/PatientEducationLinkedText.tsx`).
- **New guides:** article modules registered in `src/lib/seo/patient-intent-articles/index.ts`, themed in `src/lib/seo/patient-intent-hub-themes.ts`, routes under `src/app/<slug>/page.tsx`. Sitemap pulls from `patientIntentArticlePathnames`.
- **Homepage vs conversion meta:** `src/lib/i18n/translations/en.json` / `es.json` `marketing.meta.home`; `/request-review` metadata in `src/app/request-review/page.tsx`; sample report meta in `marketing.meta.sampleReport`.

---

## Residual overlap risks (monitor in Search Console)

1. **Shock loss vs graft failure** and **growth delay normal vs concerning** still share timeline vocabulary; kept distinct by angle (definition/two-phenomena vs milestone/delay anxiety).
2. **Bad hair transplant signs** and **unnatural hairline** both mention hairline; cross-links clarify pattern-map vs hairline-deep-dive.
3. **Methodology** and **homepage** both mention forensic domains; homepage meta shortened; methodology keeps framework depth.
4. **Demo vs sample report:** both “proof”; demo meta already steers interactive structure vs marketing walkthrough—avoid merging keywords in titles.

No new “doorway” URLs: each addition is a distinct intent with substantive body content and reciprocal internal links.
