# HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A

**Date:** 2026-08-07  
**Case:** `83de37d6-5548-4efa-afe9-9ceeb34a226d`  
**Plan:** v4 / `9301046e-80fa-4cba-9828-01fe3563fdb6`  
**Record:** `cd51d8da-e4d7-4146-993f-23fecce838b7`

## Status

| Surface | Status | Notes |
|---|---|---|
| Graft Allocation Map | **GREEN** | local-illustrative-v1 retained; reclassified; clinical planning only |
| Proposed Hairline Design | DOMAIN READY | Overlay path wired (precise line / translucent wash) |
| Illustrative Projected Outcome (photoreal hair) | **RED → superseded by 2B** | See `HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B.md` — OpenAI `gpt-image-2` wired; cosmetic no longer blocked solely by ImagingOS absence |

Do **not** treat overlay / colour-fill / placeholder / DB-only rows as GREEN for projected cosmetic outcomes.

## Provider / configuration audit

| Check | Result |
|---|---|
| Required photoreal provider | **ImagingOS** (`HA_IMAGINGOS_PROJECTION_URL` + `HA_IMAGINGOS_PROJECTION_TOKEN`) via `imagingOsProvider.ts` |
| `HA_PRE_SURGERY_PROJECTION_PROVIDER` | defaults / local env: `local_illustrative` (overlay only) |
| `HA_PRE_SURGERY_IMAGINGOS_ENABLED` | `false` (`.env.example` and local) |
| ImagingOS URL configured | **No** |
| ImagingOS token configured | **No** |
| Why adapter unavailable | Credentials missing; activation global flag off; no allowlisted pilot |
| OPENAI_API_KEY present | Yes — **not** wired as a pre-surgery image-to-image projected-outcome provider |
| Former behaviour | Misconfigured ImagingOS fell back to `local-illustrative-v1` colour blocks (withdrawn) |
| New behaviour | Cosmetic generation hard-fails with: **“Projected-outcome generation is unavailable because the imaging provider is not configured.”** |

## Product separation

1. **Graft Allocation Map** — colour-coded zones; clinical planning; `artifact_type = graft_allocation_map`; local-illustrative only.  
2. **Proposed Hairline Design** — precise line / subtle translucent overlay; `artifact_type = proposed_hairline_design`.  
3. **Illustrative Projected Outcome** — photoreal hair edit of source photo; ImagingOS only; `artifact_type = illustrative_projected_outcome`.

Modes (conservative / planned / optimistic) store assumptions: graft count, recipient area, survival range, hairs-per-graft, calibre, contrast, curl/texture, native-hair contribution, projected density range.

## Existing record reclassification

| Field | Before (rejected acceptance) | After |
|---|---|---|
| id | cd51d8da-… | unchanged (retained) |
| provider | local-illustrative-v1 | unchanged |
| artifact_type | (implicit projected result) | **`graft_allocation_map`** |
| patient_sharing_enabled | true (risk of patient report inclusion) | **false** |
| patientSafeLabel | Illustrative planned projection | Graft Allocation Map · Planned clinical view |
| Patient report “Illustrative Projected Outcome” | could qualify under prior rules | **excluded** by artifact gate |

Storage object retained as clinical planning evidence (not deleted).

## UI repair

`SurgeryProjectionPlanSummary` + workspace:

- Compact current-plan summary  
- Tabs: Allocation Map / Hairline Design / Projected Outcome  
- Thumbnail gallery by artifact + mode  
- Shared review / correction drawer (form only after “Request correction”)  
- Historical versions + audit timeline collapsed by default  
- Outcome tab shows ImagingOS-unavailable messaging

## Evidence checklist

| Required | Status |
|---|---|
| Provider/configuration audit | **PASS** (this doc) |
| Real frontal projected-outcome image with natural hair | **FAIL / RED** — ImagingOS unavailable; intentionally not faked |
| Original / allocation / hairline / outcome side-by-side | Partial — UI inspect supports it; outcome pane unavailable until ImagingOS |
| Treatment-mask containment proof | Deferred to ImagingOS output validation |
| Identity-preservation review | Deferred to ImagingOS asset |
| Conservative / planned / optimistic comparison | Assumptions stored in domain; photoreal assets RED |
| Clinician approval workflow | Retained; rejecting cosmetic does not reject graft plan |
| Patient report after approval | Allocation map removed from projected-outcome section |
| Coloured-block image classified only as Graft Allocation Map | **PASS** (DB + report gate + tests) |

## Tests

```
pnpm exec tsx --test tests/preSurgeryPhotorealisticOutcome2a.test.ts
```

## Next to turn Projected Cosmetic Outcome GREEN

1. Configure `HA_IMAGINGOS_PROJECTION_URL` + `HA_IMAGINGOS_PROJECTION_TOKEN`  
2. Set `HA_PRE_SURGERY_PROJECTION_PROVIDER=imagingos` and `HA_PRE_SURGERY_IMAGINGOS_ENABLED=true` with allowlists  
3. Generate frontal illustrative_projected_outcome for plan v4  
4. Prove hair texture, hairline irregularity, density transition, mask containment, identity preservation  
5. Clinician approve + patient-share only after checklist
