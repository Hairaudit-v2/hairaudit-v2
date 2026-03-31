# GEO optimization plan (HairAudit)

GEO here means improving how HairAudit content can be understood, extracted, cited, and recommended in AI-driven search and answer experiences—without keyword stuffing, generic filler, or unsupported medical claims.

---

## A. Key page groups

### Homepage (`/`)

- **Role:** Broad brand trust, independent forensic audit positioning, primary CTAs.
- **Intent:** “What is HairAudit?” and “who is it for?”

### Methodology (`/methodology`)

- **Role:** Framework, trust, scope—how review works and what it is not.
- **Intent:** “How does HairAudit evaluate cases?” “Is this independent?” “What are the limits?”

### Request review (`/request-review`)

- **Role:** Conversion and secure submission—not long-form education.
- **Intent:** “How do I start?” “What will I upload?” “Is this independent from my clinic?”

### Sample report (`/sample-report`, `/demo-report`)

- **Role:** Proof-of-output; shows report structure and tone.
- **Intent:** “What does a report look like?” “What domains are scored?”

### FAQ (`/faq`)

- **Role:** Process, privacy, objections, logistics—short Q&A, not deep guides.
- **Intent:** “How long?” “What if I lack photos?” “Confidence scores?”

### Issue pages (`IssueEducationPage`, e.g. `/hair-transplant-graft-failure`)

- **Role:** Concise problem-intent landings; link outward to guides.
- **Intent:** Quick orientation + when structured review may help.

### Long-form guides (`PatientIntentArticlePage` + `src/lib/seo/patient-intent-articles/*`)

- **Role:** Deeper education, comparisons, evidence limits.
- **Intent:** Nuanced questions (“X vs Y”, “what photos can show”).

### Clinics / professionals (`/clinics`, `/professionals`, related subpages)

- **Role:** Transparency, standards, benchmarking—distinct from patient marketing funnel.
- **Intent:** “Standards for audits”, directory, professional trust.

---

## B. GEO opportunities per group

For each group, aim for:

| Group | Question types to answer | Citable answer format | Trust cues | Internal links |
| --- | --- | --- | --- | --- |
| Homepage | What is this? Who is it for? | Short value prop + limitation footnote | Independent, no surgery sales | Methodology, request-review, guides hub |
| Methodology | How is evidence weighed? What is out of scope? | Short answer + scoped sections + limits | Clinic vs independent distinction | `what-an-independent-hair-transplant-audit-can-and-cannot-do`, `can-a-hair-transplant-be-audited-from-photos`, second-opinion guide |
| Request-review | How do I submit? What is this page vs guides? | Short answer + step summary | Not diagnosis; secure handling | Methodology, guides hub, FAQ |
| Sample report | What do I get? | Visual + bullet “includes” (existing) | Illustrative, not a promise of scores | Request-review, methodology |
| FAQ | Process, privacy, scores | Tight Q&A schema-friendly answers | Confidence = evidence completeness | Guides hub for depth |
| Issue pages | Is my symptom normal? What next? | Short answer + scope line + photo limits | No overclaim from photos | Related guides, methodology, request-review |
| Long-form guides | Compare X/Y; interpret evidence | Short answer + key takeaways + H2 sections | Explicit photo limits | Issue pages, comparisons, request-review |
| Clinics / professionals | Standards, independence | Framework and governance language | No patient funnel blur | Methodology, evidence pages |

---

## C. Priority pages for first-pass optimization (highest leverage)

Already strong candidates; first code pass targeted these plus shared templates:

1. `/methodology`
2. `/request-review`
3. `/hair-transplant-graft-failure`, `/hair-transplant-not-growing`, `/hair-transplant-donor-overharvested` (issue template + copy)
4. `/shock-loss-vs-graft-failure`
5. `/hair-transplant-second-opinion-vs-clinic-opinion`
6. `/hair-transplant-graft-failure-what-photos-can-and-cannot-show`
7. `/normal-donor-healing-after-fue`
8. `/hair-transplant-density-too-low`
9. `/when-is-hair-transplant-growth-delay-normal-vs-concerning`
10. `/repair-vs-wait-after-poor-hair-transplant-growth`

**Next expansion (recommended):**

- `what-an-independent-hair-transplant-audit-can-and-cannot-do`, `can-a-hair-transplant-be-audited-from-photos`, `when-should-you-seek-an-independent-hair-transplant-review`
- Remaining issue pages (`hair-transplant-too-thin`, `bad-hair-transplant-hairline`) with optional `shortAnswer` / `photosCannotConfirm`
- Sample report hero copy (i18n keys) with a one-line “proof-of-output” framing
- Homepage hero (translation keys only—avoid SEO regression across locales)

---

## D. Citation-readiness checklist

Use when editing any high-traffic page:

- [ ] Direct, quotable answer near the top (without sounding robotic)
- [ ] H1 and title aligned with the primary user question
- [ ] Page-specific role clear (education vs conversion vs framework)
- [ ] Evidence / photo limits stated where outcomes are discussed
- [ ] Strong internal links to the *next* intent (guide vs issue vs submit)
- [ ] No mixed intent on one URL (e.g. long guide masquerading as FAQ)
- [ ] No unsupported outcomes or credentials
- [ ] Comparison pages: define both sides, confusion point, practical framework, links

---

## E. AI-answer risk checklist (what to avoid)

- Overclaiming what photos or remote review can prove
- Vague medical language that sounds diagnostic
- Duplicate pages with the same framing (cannibalization + model confusion)
- Weak distinction between educational content and conversion pages
- Missing limitations on photo-based review
- Synthetic trust (fake reviews, inflated authority)
- Turning every page into identical “Short answer / FAQ” blocks

---

## F. Implementation notes

See `GEO_IMPLEMENTATION_NOTES.md` for the concrete first-pass code and content changes.
