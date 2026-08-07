# HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B

**Date:** 2026-08-07  
**Case:** `83de37d6-5548-4efa-afe9-9ceeb34a226d`  
**Plan:** v4 / `9301046e-80fa-4cba-9828-01fe3563fdb6`  
**Outcome under clinician review:** `218901ef-fd22-4ea6-ab24-37ee2e77d278`  
**Hairline gate:** `3af857db-596b-4c0d-8dc7-eb3ce3f892a6` (approved `proposed_hairline_design`)  
**Evidence:** `tmp/pre-surgery-openai-outcome-2b/`

## Status

| Surface | Status | Notes |
|---|---|---|
| Graft Allocation Map | **GREEN** | unchanged from 2A (`cd51d8da-…`) |
| Proposed Hairline Design | **GREEN** (planning) | approved + versioned + bound to plan v4 |
| Illustrative Projected Outcome | **AMBER** | OpenAI `gpt-image-2` edit succeeded; automated containment pass; **not GREEN** until clinician approve of natural hair / identity / density |

Configuration and a successful API response are **not** GREEN.

GREEN still requires: visible natural hair (not coloured blocks), acceptable identity, clinically reasonable hairline/density/direction, no material out-of-mask change, clinician approval, successful professional workspace render.

## Provider strategy correction

Do **not** leave cosmetic outcomes RED solely because ImagingOS URL/token are absent when `OPENAI_API_KEY` is present.

| Field | Value |
|---|---|
| `provider_id` | `openai-gpt-image` |
| `model` | `gpt-image-2` |
| `artifact_type` | `illustrative_projected_outcome` |
| selection | `HA_PRE_SURGERY_PROJECTION_PROVIDER=openai` (also preferred when key present for cosmetic outcomes) |
| ImagingOS | remains optional future provider — not required for this pilot |

Provider-neutral projection boundary preserved (`PreSurgeryProjectionProvider`). ImagingOS adapter retained. No domain-wide OpenAI hard-coding. No `local-illustrative-v1` fallback for cosmetic outcomes.

## Implementation summary

1. **Config / health** — `openai` kind; credentials via `OPENAI_API_KEY`; cosmetic health prefers OpenAI over ImagingOS when key present; hard-fail with precise blocker categories when unavailable.
2. **Edit (not generate-from-scratch)** — Images API `images.edit` with source photo + recipient mask + clinical prompt + high quality JPEG.
3. **Hairline gate** — no outcome until approved/versioned hairline design (artifact) or approved annotation fallback bound to plan.
4. **Aspect-preserving pad** — source 1799×2400 letterboxed into `1024×1536` before edit; unpadded after. Prior stretch-fill caused horizontal shear / identity seams (rejected pilots).
5. **Dual mask** — soft alpha for OpenAI guidance; hard mask for containment composite + validation.
6. **Containment composite** — restore out-of-mask source pixels after model edit (API mask adherence is guidance-only).
7. **Post-gen validation** — dimensions/MIME/bytes/checksums; out-of-mask / face / background deltas. Failures → `validation_failed` / `clinician_review_failed` — never auto-approved.
8. **Persistence** — new `illustrative_projected_outcome` rows only; source photo untouched; sharing off; clinician decision required.
9. **UI** — Accuracy review side-by-side: Original · Hairline · Allocation map · Outcome; Reject / Regenerate / Request correction / Approve.

## Pilot artifacts

| Role | Id / path | Status |
|---|---|---|
| Hairline design | `3af857db-596b-4c0d-8dc7-eb3ce3f892a6` | approved |
| Outcome (current) | `218901ef-fd22-4ea6-ab24-37ee2e77d278` | `clinician_review`, sharing off |
| Rejected (shear / hard rectangle / prior) | `43d9ccdc-…`, `5d6b65be-…`, `888131c1-…`, `2791b827-…`, `189ed72c-…` | rejected / validation_failed |

Provider / model on current outcome: `openai-gpt-image` / `gpt-image-2`. Prompt version: `ha-openai-projected-outcome-prompt-v2`.

Automated validation (hard mask) on current outcome:

- out-of-mask mean ≈ 0.77; face band ≈ 0.59; dimensions 1799×2400 match source
- patient sharing remains **false**

## Known clinical follow-ups (keep AMBER)

- Mask polygons still produce a relatively sharp recipient boundary; further soft irregular leading-edge quality is a clinician judgment call and may need mask/prompt iteration or regenerate.
- Do not auto-approve based on delta metrics alone.

## Tests

- `tests/preSurgeryOpenAiImageProvider2b.test.ts` — config, health, hairline gate, prompt, canvas size, aspect-fit pad/unpad
- `tests/preSurgeryPhotorealisticOutcome2a.test.ts` — still passes (no local-illustrative cosmetic fallback)

## Env

```
HA_PRE_SURGERY_PROJECTION_PROVIDER=openai
OPENAI_API_KEY=<present>
# optional: HA_OPENAI_GPT_IMAGE_MODEL=gpt-image-2
```

Precise blockers when OpenAI cannot execute: model access, organisation verification, moderation, API-key/environment, billing, unsupported request, implementation failure.
