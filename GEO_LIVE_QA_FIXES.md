# GEO live QA — fixes implemented

Documentation for the **reading-flow / extraction / mobile balance** pass after the first GEO implementation.

---

## Components reviewed

| File | Purpose |
| --- | --- |
| `src/components/patient-education/GeoContentBlocks.tsx` | GEO presentation primitives |
| `src/components/patient-education/PatientIntentArticlePage.tsx` | Long-form guide layout |
| `src/components/patient-education/IssueEducationPage.tsx` | Issue landing layout |
| `src/app/methodology/page.tsx` | Framework / trust page |
| `src/app/request-review/page.tsx` | Conversion page |

---

## Issues found

1. **Methodology:** Opening **two paragraphs** plus a **cyan “Short answer”** restated the same framework claims (forensic audit, AI + reviewers, not diagnosis)—felt like a double intro and competed with the H1 for attention.
2. **Request-review:** **Hero + “What this page is for” + “Short answer”** repeated independent forensic framing and “not diagnosis” before the user reached privacy and CTAs—too many bordered blocks for a conversion page.
3. **Patient guides:** Order was **intro → short answer → key takeaways → next steps**, pushing primary **routing** (request review, sample report) below a long bullet list on small viewports.
4. **Issue landings:** **Three full-width cards** (short answer, scope, photo limits) back-to-back felt **heavy** relative to “concise issue page” intent.
5. **Guide copy:** Two **key takeaway** lines read as **internal/editorial** instructions (“when citing HairAudit”) rather than patient guidance.
6. **Evidence-limits guide:** One takeaway framed page **role** in a slightly clunky way; tightened wording while keeping the link to the issue landing.

---

## Exact fixes implemented

### `GeoContentBlocks.tsx`

- **`GeoShortAnswer` / `GeoKeyTakeaways`:** optional `spacing="tight"` for reduced top margin when stacked under intros.
- **`GeoContextLine`:** optional `variant="inline"` (left rule, no full card) for lighter scope notes on issue pages.
- **`GeoPhotosCannotConfirm`:** optional `density="compact"` (tighter padding and slightly smaller list text).

### `PatientIntentArticlePage.tsx`

- Order is now: **intro → short answer → Next steps → Key takeaways** (then article sections).
- Short answer uses **`spacing="tight"`**; key takeaways use **`spacing="tight"`** after next steps.

### `IssueEducationPage.tsx`

- Short answer: **`spacing="tight"`**.
- “What this page helps explain”: **`GeoContextLine` `variant="inline"`**.
- Photo limits: **`density="compact"`**.

### `methodology/page.tsx`

- Removed **`GeoShortAnswer`** entirely.
- Replaced the first two paragraphs with **one merged lead paragraph** that carries the extractable framework summary (domains, AI + clinical review, documentation vs diagnosis/treatment).
- Unchanged: **“How this differs from a typical clinic opinion”** and **“What photos and a remote audit cannot replace”** cards, subsequent sections, next steps.

### `request-review/page.tsx`

- Removed **`GeoShortAnswer`**.
- Added **one plain `p`** (`text-sm text-slate-400`) for what submission produces, without a second card.
- Unchanged: **“What this page is for”** card, trust line, privacy block, CTAs.

### Article modules (copy only)

| File | Change |
| --- | --- |
| `hair-transplant-density-too-low.ts` | Fourth key takeaway reworded to patient-facing hub routing. |
| `hair-transplant-second-opinion-vs-clinic-opinion.ts` | Fourth key takeaway shortened; removed “intake form” jargon. |
| `hair-transplant-graft-failure-what-photos-can-and-cannot-show.ts` | Fourth key takeaway reworded for clarity and patient tone. |

---

## Pages intentionally left unchanged

- **Homepage**, **FAQ body**, **sample-report** marketing (i18n-heavy)—no structural GEO edits in this pass.
- **Issue pages** without optional GEO fields (`hair-transplant-too-thin`, `bad-hair-transplant-hairline`)—deferred to next controlled batch.
- **Shock loss vs graft failure** intro/short answer—read as complementary (worry framing vs definitions); no edit.
- **Most patient-intent articles** without this pass touching copy.

---

## Remaining risks to monitor in production

- **Scroll depth:** Moving **key takeaways** below **next steps** may slightly reduce how often casual readers see all bullets; watch engagement on long guides if metrics are available.
- **Issue pages:** **Quick summary** vs **short answer** still partially overlap—acceptable for scan patterns, but avoid expanding both with near-duplicate lines when adding new issues.
- **Methodology word count:** Single lead paragraph is denser; if heatmaps show low read-through, consider a soft line break into two shorter paragraphs **without** reintroducing a duplicate GEO box.

---

## Recommendations for the next controlled rollout batch

1. Add **optional GEO fields** to **`hair-transplant-too-thin`** and **`bad-hair-transplant-hairline`** using **inline scope** + **compact limits** only if needed—do not add a third redundant list.
2. Add **`shortAnswer` + `keyTakeaways`** to **`what-an-independent-hair-transplant-audit-can-and-cannot-do`** and **`can-a-hair-transplant-be-audited-from-photos`**; cross-link methodology once to avoid duplicate essays.
3. Revisit **request-review** if analytics show confusion between **education** and **submit**—consider a single secondary link row above the fold without adding more bordered regions.

---

## Verification

- `npm run build` succeeded after these changes.
