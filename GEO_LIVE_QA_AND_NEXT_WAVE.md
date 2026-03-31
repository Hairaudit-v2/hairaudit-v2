# GEO live QA and next wave (reading-flow review)

This pass reviewed the first GEO implementation as if read by a worried patient, an answer engine, and a trust-focused reviewer. Changes were **narrow**—balance, duplication, and routing—not a new content rollout.

---

## A. Pages reviewed

| Page / type | Route or source |
| --- | --- |
| Methodology | `/methodology` |
| Request review | `/request-review` |
| Long-form guides (sample of 3) | `/shock-loss-vs-graft-failure`, `/hair-transplant-density-too-low`, `/hair-transplant-second-opinion-vs-clinic-opinion` (+ spot-check `/hair-transplant-graft-failure-what-photos-can-and-cannot-show`) |
| Issue landings (2) | `/hair-transplant-not-growing`, `/hair-transplant-graft-failure` (template + `patientEducationIssues.ts`) |
| Comparison-style | `/shock-loss-vs-graft-failure`, `/hair-transplant-second-opinion-vs-clinic-opinion` |
| Evidence-limits | `/hair-transplant-graft-failure-what-photos-can-and-cannot-show` |
| Shared components | `GeoContentBlocks.tsx`, `IssueEducationPage.tsx`, `PatientIntentArticlePage.tsx` |

---

## B. What worked well

- **Short answers** on guides still give a clean extractable unit without replacing the narrative intro (intro = context; short answer = definitional or decision framing).
- **Issue pages** benefit from an early direct answer plus explicit photo limits; trust language stays factual, not defensive.
- **Methodology** benefits from separate blocks for “clinic vs independent” and “what photos cannot replace”—distinct angles, not repeated slogans.
- **Internal links** on methodology and request-review correctly route education vs conversion vs framework.
- **Tone** remained clinical and calm; no generic “AI-optimized” filler was introduced in this pass.

---

## C. What needed adjustment (addressed in code)

- **Methodology:** The opening duplicated the later cyan “Short answer” box (same ideas: framework, AI + humans, not diagnosis). Merged into a **single authoritative lead paragraph** and removed the extra boxed block so the page stays framework-first, not “article with two intros.”
- **Request-review:** Two boxed GEO regions plus the hero paragraph repeated “independent forensic / not diagnosis.” Replaced the second box with **one plain supporting paragraph** so the first screenful stays conversion-forward with less card stacking.
- **Long-form template:** Intro → short answer → **key takeaways** → next steps stacked four deep before body copy. **Next steps** now sit **immediately after** the short answer so routing is earlier; key takeaways follow (still in the first screen on many devices, still extractable for models).
- **Issue template:** Three bordered regions in a row felt heavy on mobile. **“What this page helps explain”** now uses an **inline** (left-rule) variant; **short answer** and **photo limits** use **tighter spacing / compact** density.
- **Key takeaway bullets** on two guides contained **editorial/meta** language (“when citing HairAudit”). Reworded to **patient-facing routing** copy.

---

## D. Over-structured vs under-structured (current state)

| Area | Assessment |
| --- | --- |
| Methodology | **Balanced** after merge—one lead + two contextual cards + sections. |
| Request-review | **Balanced**—one role card + plain outcome line + existing trust UI. |
| Guides with GEO fields | **Balanced**—short answer + next steps + takeaways before H2 body; watch total bullet count on future pages. |
| Issue pages with full GEO fields | **Slightly dense** but acceptable with inline scope + compact limits; “Quick summary” still overlaps short answer a little by design (summary = scan list). |
| Issue pages **without** GEO fields | **Under-structured** for extraction (`hair-transplant-too-thin`, `bad-hair-transplant-hairline`)—good candidates for next wave. |
| Scope articles (`what-an-independent-hair-transplant-audit-can-and-cannot-do`, etc.) | **Under-structured** relative to guides—high value for citations, not yet given `shortAnswer` / `keyTakeaways`. |

---

## E. Next best rollout targets for GEO blocks

Prioritize **high intent** and **clear non-duplication** with existing URLs:

1. **`/hair-transplant-too-thin`** and **`/bad-hair-transplant-hairline`** — add optional `shortAnswer` + `photosCannotConfirm` (and scope line if needed); keep copy short.
2. **`/what-an-independent-hair-transplant-audit-can-and-cannot-do`** — `shortAnswer` + tight `keyTakeaways`; links to methodology and request-review.
3. **`/can-a-hair-transplant-be-audited-from-photos`** — same pattern; must stay tightly aligned with limits language on methodology.
4. **`/when-should-you-seek-an-independent-hair-transplant-review`** — bridges FAQ-style intent to conversion; one short answer, minimal bullets.
5. **Remaining comparisons** (e.g. repair vs wait, growth delay) already have GEO fields; **spot-check** only if analytics show high impressions.
6. **`/should-you-trust-a-clinic-assessment-of-its-own-work`** — natural companion to second-opinion guide; add GEO only if it does not cannibalize the other URL.

---

## F. Guardrails for next rollout

- Do **not** stack **card** GEO blocks for every subsection—use **inline** or plain prose when the page already has multiple bordered regions.
- **Comparison pages:** Ensure the **first screenful** distinguishes **both concepts** (short answer or intro + short answer); avoid repeating the same sentence in intro and short answer.
- **Issue pages:** Prefer **short answer + compact limits**; avoid a fourth parallel list that repeats “Quick summary” verbatim.
- **Request-review:** Stay **conversion-oriented**—role clarity in one place; outcome in plain text or a single line; no long-form article feel.
- **Methodology:** Stay **framework-oriented**—avoid duplicating full guide paragraphs; link out to patient guides for depth.
- **Key takeaways:** Must read well for **humans** (no “citation” or “SEO” meta); routing links are fine when framed as next steps.

---

## G. Related docs

- `GEO_OPTIMIZATION_PLAN.md` — strategy and page groups  
- `GEO_IMPLEMENTATION_NOTES.md` — first-pass implementation list  
- `GEO_LIVE_QA_FIXES.md` — exact fixes from this QA pass  
