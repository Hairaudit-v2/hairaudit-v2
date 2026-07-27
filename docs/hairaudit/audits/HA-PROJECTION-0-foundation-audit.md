# HA-PROJECTION-0 — Foundation Audit

**Date:** 2026-07-27  
**Mode:** Read-only architecture and capability discovery  
**Scope:** HairAudit (`hairaudit-v2`) for future Surgery-Day Projected Result Analysis  
**Constraint:** No implementation, migrations, endpoints, DTOs, prompts, or UI in this phase  
**PHI:** None — aggregate SQL only; counts not executed against production in this audit

---

## Verdict

**PARTIAL FOUNDATION**

HairAudit already has explicit surgery-day evidence taxonomies, rich clinic/patient procedure metadata, production OpenAI vision forensic scores that describe **observed** procedural characteristics, dual-pathway PDF/report infrastructure, and FiOS classifier plumbing for view/quality classification. It does **not** yet have measured anatomical geometry, graft/site detection, a projection/outcome model, projected-vs-observed lineage, or a patient-app `assessmentType` gateway in this repository.

---

## 1. Evidence taxonomy

### Canonical sources

| Role | Path |
|------|------|
| Primary patient upload taxonomy | `src/lib/patientPhotoCategoryConfig.ts` |
| Patient audit buckets | same file (`PATIENT_AUDIT_PHOTO_BUCKET_DEFS`) + `src/lib/auditPhotoSchemas.ts` |
| Pathway evidence packs | `src/lib/patient/patientReviewPathway.ts` |
| Milestone equivalence | `src/lib/patient/patientPhotoSatisfaction.ts` |
| Clinic/doctor slots | `src/lib/doctorPhotoCategories.ts`, `src/lib/clinicPhotoCategories.ts`, `photoSchemas.ts` |
| Mobile surgery portal | `src/lib/surgeryUpload/checklist.ts` |
| Evidence-intelligence abstract keys | `src/lib/evidence/evidenceRequirements.ts` |

**Storage prefixes:** `patient_photo:{key}` · `doctor_photo:` / `clinic_photo:{key}` · `surgery_photo:{slot}`

### Inventory (projection-relevant)

| Image type | Existing key(s) | Patient/clinic | Current purpose | Useful for projection? |
| ---------- | --------------- | -------------- | --------------- | ---------------------- |
| Pre-op front | `preop_front`, `img_preop_front`, surgery `preop_recipient` | Both | Baseline anterior/hairline | **Yes — baseline** |
| Pre-op left/right temporal | `preop_left/right`, `img_preop_left/right` | Both | Temple/side baseline | Yes |
| Pre-op top / crown | `preop_top/crown`, `img_preop_top/crown` | Both | Vertex/crown baseline | Yes |
| Pre-op donor | `preop_donor_rear`, `img_preop_donor_*`, surgery `preop_donor` | Both | Donor baseline | Secondary |
| Pre-op hairline close-up | `preop_hairline_closeup` (hidden) | Patient | Design detail | Yes (hidden Stage-2) |
| Surgery-day recipient | `day0_recipient`, `img_immediate_postop_recipient`, surgery `postop_recipient` | Both | Immediate post-op recipient | **Core** |
| Surgery-day donor | `day0_donor`, `img_immediate_postop_donor`, surgery `postop_donor` | Both | Immediate post-op donor | Secondary / extraction |
| Surgery-day design | `img_marking_design`, surgery `hairline_design` | Clinic/surgery | Planned hairline | **High** |
| Intra-op recipient sites | `intraop_recipient_sites`, `img_site_creation` | Both (mostly hidden) | Pre-implant sites | High if present |
| Intra-op implantation | `intraop_implantation`, `img_implantation_stage`, surgery `implantation_progress` | Both | Placement in progress | High if present |
| Graft tray / count board | `graft_tray_*`, `graft_count_board`, surgery `graft_quality` | Both | Graft quality/count cues | Indirect |
| Early healing | `postop_day0`, `postop_day1_*`, `postop_week1_*`, `any_early_postop_day0_3` | Patient | Day 0–7 healing | Near-day-0 validation |
| Milestone 3/6/9/12 | `postop_month{N}_{front,top,crown,donor}` | Patient (mostly hidden) | Outcome ground truth | **Yes — future compare** |
| Recipient close-up (current) | `current_recipient_closeup` | Patient | Post-pathway detail | Outcome, not day-0 seed |
| Clinic/staff images | `clinic_photo:` / `doctor_photo:` same `img_*` keys | Clinic | Clinical evidence | Prefer over patient when both exist |
| Generic surgery-day bucket | `any_day0` | Patient audit scoring | Collapsed day-0 dump | **Weak — avoid as primary** |
| Bulk / academy taxonomies | `BULK_IMAGE_CATEGORIES`, `training_photo:*` | Clinic/academy | Parallel schemas | Map carefully; not canonical |

### Surgery-day canonical vs generic

**Surgery-day is already an explicit category family**, not only a generic upload:

- Patient phase `day_of_surgery` with keys `day0_recipient`, `day0_donor` (+ Stage-2 `day0_donor_*`, `intraop_*`)
- Clinic/doctor required `img_immediate_postop_recipient` / `img_immediate_postop_donor`
- Surgery portal required `postop_recipient` / `postop_donor` (+ `hairline_design`)

**Caveats:**

1. Patient audit scoring often **normalizes** `day0_*` / `intraop` → generic bucket `any_day0`.
2. Post-surgery pathway treats day-0 as **recommended**, not required (required set is “current” views, often stored under `preop_*` keys with relabeled UI).
3. Three parallel naming systems must be aliased for projection evidence policy.

**Projection evidence priority:** prefer explicit day-0/immediate-post-op keys + design markings; use `any_day0` only as fallback.

---

## 2. Procedure metadata

### Storage layers (not one FiOS schema)

| Layer | Persistence | Reliability baseline |
|-------|-------------|----------------------|
| Clinic/doctor answers | `reports.summary.clinic_answers` / `doctor_answers` JSONB | Clinic-reported (+ provenance) |
| Patient audit v2 | `reports.patient_audit_v2` | Patient-reported |
| Surgery upload details | `surgery_upload_details` columns | Clinic-reported (OR) |
| Clinical history | `hairaudit_case_clinical_history` | Auditor/operator-entered |
| Graft Integrity | `graft_integrity_estimates` | AI-derived + auditor-adjusted |
| Option registry | `src/lib/audit/masterSurgicalMetadata.ts` | Vocab only |

FiOS/ImagingOS payloads in this repo carry **image classification only** — not procedure metadata.

### Field matrix

| Field | Exists? | Canonical source | Reliability | Currently patient-safe? | Projection value |
| ----- | ------: | ---------------- | ----------- | ----------------------: | ---------------- |
| Procedure date | Yes | Patient `procedure_date`; clinic/doctor `surgery_date`; `surgery_upload_details.surgery_date` | Patient / clinic / auditor by layer | Partial (own date yes) | Stage anchoring |
| Procedure type | Yes (vocab differs) | Clinic `procedure_type[]`; patient `fue\|fut\|dhi\|…`; surgery upload = anatomic case type | Reported | Partial | Technique context |
| FUE | Yes (enum value) | Clinic/patient/clinical history | Reported | When patient/clinical-sourced | Label |
| DFI | **No** | — | — | — | Absent (closest: DHI) |
| Graft count | Yes | `planned_graft_count` / `actual_graft_count`; patient `graft_number_received`; surgery `planned/actual_grafts`; GII claimed | Clinic/patient; GII AI | Partial | **High** |
| Hair count | Partial | `estimated_hair_count`; academy `total_hairs`; rule-derived from FU breakdown | Mixed | Clinical estimated: yes | Moderate |
| Hairs-per-graft | Yes | `avg_hairs_per_graft`; clinical + calc; patient `graft_ratio` | Mixed | Clinical avg: yes | High |
| Punch size | Yes | `punch_sizes_used[]`, surgery `punch_size`, clinical `punch_size_mm` | Clinic/auditor | Clinical mm: yes | Moderate |
| Extraction method | Yes | Clinic enums + clinical history | Clinic/auditor | Not in patient-safe lines | Technique |
| Implantation method | Yes | Clinic/clinical/surgery TEXT | Clinic/auditor | No (professional) | Technique |
| Recipient area | Partial (zones) | `areas_treated[]`, `zones_planned[]`, clinical `recipient_zones[]` | Clinic/auditor | Limited | Zone scope |
| Donor area | Partial | Flags + ratings + clinical depletion/reserve | Mixed | Depletion/reserve: yes | Secondary |
| Hairline info | Yes (flags/quality, not geometry) | Strategy/direction quality; patient naturalness | Mixed | Patient scores: yes | Design cues |
| Surgeon / clinic | Yes | Patient + clinic + surgery + clinical prior | Reported | Names often excluded from patient-safe | Attribution only |
| Medications | Yes | Clinic postop; clinical `medication_history`; patient enhanced | Mixed | Subset yes | Native-hair dependency |
| Intra-op PRP / biologics | Yes | `intraop_prp_used`, `intraop_exosomes_used`, surgery BOOLs | Clinic | Clinical flags: yes | Soft modifier |
| Procedure notes | Yes | Many free-text slots | By role | Mostly excluded | Human context |
| Graft breakdown (1/2/3/4+) | Partial | Numeric counts **only** in clinical history; clinic has sorting method flags | Auditor counts | Counts not patient-safe today | High if filled |
| Donor density | Yes (rating + optional FU/cm²) | Clinic `donor_density_*`; doctor measured flags | Clinic | Numeric: professional | Moderate |
| Recipient density | **No** structured | Proxies: `density_goal_by_zone` text, AI narrative | — | — | Gap |
| Planned graft distribution | **No** numeric | Proxies: `zones_planned[]` + free text | Clinic | Professional | Gap |

**Do not treat evidence classes as interchangeable:** clinic-reported ≠ patient-reported ≠ AI-derived ≠ auditor-entered.

---

## 3. Image intelligence

### Actual current contract

```text
Upload APIs
  → fiImageIntelligenceEnqueue (env-gated)
  → Inngest worker
  → classifyHairAuditImage (adapter: dry_run | stub | fi_os legacy | unified)
  → persist fi_image_intelligence_processed_jobs
  → write-back uploads.metadata (category, confidence, quality/protocol)
```

**Persisted (`FiImageIntelligenceResult`):** classification status, `canonical_photo_category`, confidence, quality/protocol status, model provider/version, fetch metadata.

**Not persisted:** segmentation, landmarks, density maps, graft counts, angles, within-image zones.

### Within-image anatomical analysis?

| Capability | Status |
|------------|--------|
| View / photo category classification | Production (env-gated; default often dry_run) |
| Quality / protocol / blur scores | Partial (status strings; blur mainly shadow) |
| Duplicate / exposure / crop checks | Contract enums in `uploadContract.ts` — not executed as ImagingOS analytics here |
| Anatomical analysis (geometry, sites, density maps) | **Not in HairAudit** — engines literally “Await ImagingOS” |
| Local clinical model hook | `classifyClinicalHairImageFromModelUrl.ts` — **always returns null** (placeholder) |
| ImagingOS module | **Documented-only** in FI OS (`docs/fin-imaging-1-…`); not in this repo |

**OpenAI forensic audit** (`src/lib/ai/audit.ts`) is a separate vision path that produces qualitative section scores and findings — not ImagingOS feature extraction.

---

## 4. Audit-engine outputs

Primary production schema: `AIAuditResult` / `hairaudit_forensic_audit_v3` in `src/lib/ai/audit.ts`.

| Output | Existing? | AI/rules/manual | Image evidence required | Projection reuse? |
| ------ | --------: | --------------- | ----------------------- | ----------------: |
| Hairline design | Yes | AI (`section_scores.hairline_design` + findings) | Prefer images | **Yes as observed features** (not geometry) |
| Recipient placement | Yes | AI | Prefer images | Yes — observed pattern |
| Density distribution | Yes | AI | Images + answers | Qualitative only |
| Donor management | Yes | AI | Images | Observed harvest pattern |
| Extraction quality / pattern | Yes | AI + fingerprint rules | Donor views | Surgery-day donor reuse |
| Graft placement / spacing | Yes | AI + intelligence placeholders | Day-0 preferred | Qualitative |
| Angulation / direction | Partial | AI findings + patient answers | Helps | Visual, not measured |
| Symmetry / irregularity / naturalness | Yes | AI (`naturalness_and_aesthetics`; rubric mentions irregularity) | Images | **Strong narrative reuse** |
| Coverage | Partial | Rules (evidence coverage meta) | Photos | Meta, not scalp map |
| Healing | Yes | AI + report rules | Follow-up helps | Timeline, not projection |
| Overharvesting | Yes | AI + repair rules | Donor follow-up for repair | Risk bands |
| Native hair blending | Partial | AI visual + manual answers | Visual | Soft foundation |
| Progression | Yes | Educational rules | Mixed | Explicitly not surgery-day prediction |
| Repair considerations | Yes | Rules + AI inputs | Healed views | Separate product surface |
| Procedural quality scores | Yes | See §5 | Mixed | Observed, not predicted |
| Surgical fingerprint cards | Yes | Rules on AI + photo presence | Elite path | Qualitative reconstruction |
| HA-INTELLIGENCE engines | Yes (code) | `rule_based_placeholder` / classifier-enriched | Category-driven | Scaffold only |

**Important semantic finding:** rubric language already describes observations such as even distribution, hairline irregularity/softness, clustering, temporal transition — these are **observed procedural characteristics**, reusable as surgery-day feature labels, **not** predicted final results.

---

## 5. Procedural scoring

| Score family | Names | Range | Source | Patient-facing | Semantics |
|--------------|-------|-------|--------|----------------|-----------|
| Forensic AI sections | `donor_management`, `extraction_quality`, `recipient_placement`, `hairline_design`, `density_distribution`, `graft_handling_and_viability`, `post_op_course_and_aftercare`, `complications_and_risks`, `naturalness_and_aesthetics`, `overall_score` | 0–100 | OpenAI vision + answers | Softened / qualitative labels | **Observed / evidence-conditioned** |
| Benchmark domains | SP, DP, GV, IC, DI | 0–100 | Derived from AI + completeness | Clinician/benchmark | Observed / documentation quality |
| Pathway scorecards | Post: donor_preservation, extraction_pattern, density_distribution, recipient_area, healing_quality | Qualitative/cards | Report builders | Patient pathway PDF | Observed framing |
| Graft Integrity Index | Estimated ranges vs claimed | Ranges + 0.45–0.95 conf | Vision AI + auditor gate | Gated rollout | Observed estimate, not future projection |
| HA intelligence severity | none→critical bands | Ordinal | Rule placeholders | Off by default | Advisory |
| AuditOS scoring types | Structural adapters | — | Stage 4A placeholder | Shadow | Not production scoring |

**Correspondence to projection themes:** hairline, density, distribution, donor management, direction, recipient planning, graft handling, overall procedural quality — **all have observed-score analogues**. None are “predicted final cosmetic result” scores.

Elite “Predictive Outlook” (`EliteReportHtml.tsx`) is narrative graft-survival language on the elite/legacy path — **high medical-risk reuse**; do not treat as production projection foundation.

---

## 6. Zone concepts

**No single canonical scalp-map geometry object** in HairAudit. Parallel taxonomies:

| Taxonomy | Entries | Consumers |
|----------|---------|-----------|
| `AREAS_TREATED_OPTIONS` / `ZONES_PLANNED_OPTIONS` | hairline, temples, frontal_tuft, forelock, midscalp, crown, … | Clinic/doctor forms |
| Miniaturisation regions | hairline, frontal, midscalp, crown, donor, temples | Advanced intake |
| Clinical history `recipient_zones` | frontal_hairline, temples, mid_scalp, crown, donor, unknown | Clinical history |
| Photo categories | front, top, crown, donor, recipient, hairline, … | Uploads / classifier |
| Patient photo regions | `PatientPhotoRegion` in category config | Upload metadata |
| AI photo_observations views | preop_front … postop_healed | Forensic AI |
| FI OS scalp maps | imagingOs (external) | **Documented-only** |

**Recommendation:** Projection must adopt **one** of the existing zone vocabularies (prefer `masterSurgicalMetadata` / clinical history alignment) — do **not** invent Zone 1–4.

---

## 7. Graft counting / density capability

| Capability | Classification |
|------------|----------------|
| Claimed/planned/actual graft counts (forms) | **production** (manual) |
| Clinical history singles/doubles/triples/quads | **production** (manual/auditor) |
| Graft Integrity AI ranges | **production** (experimental clinical AI; auditor-gated) |
| Donor density rating / optional FU/cm² (forms) | **production** (manual) |
| Intelligence `donorDensityBand` | **placeholder** (rules) |
| Site detection / implantation-site counting from pixels | **not present** |
| Extraction-site counting from pixels | **not present** |
| Recipient surface area / sites/cm² from image | **not present** |
| Pixel-to-mm calibration / scale markers | **not present** |
| ImagingOS density analytics | **documented only** (FI OS) |
| Marketing `DensityMapGrid` (hardcoded %) | **not intelligence** |

Be strict: placeholders and marketing mocks are **not** existing intelligence.

---

## 8. Hairline geometry capability

| Kind | Status |
|------|--------|
| Measured mm / landmarks / curve params | **not implemented** |
| Patient answer `hairline_height_changed_cm` | Manual optional |
| Form strategy / direction quality / angle notes | Manual text/select |
| AI `hairline_design` score + findings | **Visually described** |
| Fingerprint hairline transition labels | **Visually described** |
| Facial landmarks / frontotemporal angle math | **not implemented** |

**Implication:** HA-PROJECTION-1 can reuse qualitative hairline observations immediately; measured geometry requires a **new ImagingOS module** (or FiOS HIE feature extraction), not HairAudit-local inventiveness.

---

## 9. Donor analysis

### Post-healing outcome analysis (existing)

- Forensic AI `donor_management` / `extraction_quality` on healed donor views
- Repair / overharvesting intelligence (wants healed follow-up)
- Follow-up donor milestone keys (`postop_month*_donor`)
- Clinical history donor depletion / reserve

### Surgery-day extraction analysis (partial)

- Explicit day-0 donor slots across patient/clinic/surgery portal
- GII prefers day-0 donor for estimates
- Fingerprint donor extraction pattern (needs ≥2 donor views)
- Intra-op extraction / donor close-up Stage-2 slots (hidden)

**No separate dual engine** for surgery-day vs healed — timing is implied by photo category + prompt, not by a dedicated extraction analytics model.

### Reasonable from immediate post-op donor photos

| Observation | Plausible from day-0 donor? |
|-------------|----------------------------|
| Punch spacing / clustering / moth-eaten pattern | Yes (qualitative AI today) |
| Harvested area extent / laterality | Yes (view-level) |
| Safe-zone respect (gross) | Partial |
| Scar maturity / long-term depletion | **No** — needs healed follow-up |
| Exact FU/cm² remaining | **No** without calibration + density CV |

---

## 10. Native-hair analysis

| Signal | Status |
|--------|--------|
| Fingerprint “native flow” / direction mismatch | Heuristic |
| AI aesthetics / blending language | Visual AI |
| Intake `native_hair_protection_strategy` | Manual |
| Patient `direction_matches_native`, `crown_swirl_matches` | Manual |
| Miniaturisation region flags | Form + weak rules |
| Medications / progression education | Rules (`futureHairLossProgressionRisk`, preservation modules) |
| Pixel native-density / AGA map | **Not implemented** |
| Explicit pre-op pattern vs placement comparison module | **Not implemented** as a first-class engine |

**Native Hair Dependency** could build on: pre-op baseline photos + areas_treated/zones + meds + progression education — but the comparative “placement vs preoperative native pattern” engine does not exist yet.

---

## 11. Temporal / stage logic

| Mechanism | Values | Path |
|-----------|--------|------|
| Photo phase | preoperative, day_of_surgery, perioperative, early_postoperative, intraoperative, follow_up | `patientPhotoCategoryConfig.ts` |
| Review pathway | **`pre_surgery` \| `post_surgery` only** | `patientReviewPathway.ts` |
| Intake `months_since` | under_3, 3_6, 6_9, 9_12, 12_plus | `patientAuditSchema.ts` |
| Observation stages (summary) | preop, day0, early_healing, month bands | `patientSafeSummary.ts` |
| Milestone equivalence | Band → `postop_month{N}_{view}` fills “current” | `patientPhotoSatisfaction.ts` |
| Follow-up timeline | day1, week1, month3–12 | `followupTimelineFromPatientUploads.ts` |

### Critical finding

Product pathway jumps:

```text
pre_surgery  →  post_surgery
```

There is **no** first-class `surgery_day` / `immediate_post_op` pathway. Surgery-day exists in **photo phase / observation stage / upload keys**, and as recommended evidence on post-surgery packs — but not as a pathway state.

Projection should either:

1. Add an assessment kind / report mode that sits on surgery-day evidence without abusing `pre_surgery`, or  
2. Extend stage model on results while keeping pathway as submitter framing.

---

## 12. Longitudinal comparison

| Capability | Exists? | Notes |
|------------|---------|-------|
| Milestone photo taxonomy | Yes | month3/6/9/12 keys |
| Timeline presence UI | Yes | Clinic follow-up panel; auditor ForensicCaseTimelineViewer |
| Report version history | Yes | `reports.version` — same-case PDF versions |
| Auditor rerun lineage | Yes | source→target report version |
| Side-by-side image compare | **No** (patient) | Demo/marketing only |
| Progress scores baseline vs current | **No** | |
| Image matching / registration | **No** | VIE exists in FI OS docs only |
| Multi-case / previous-audit graph | **No** | |
| Projected Day-0 ↔ observed Month N | **No** | |

**Lineage that exists:** report versions + evidence timeline + optional intelligence snapshots.  
**Lineage needed for Projection:** assessment result identity spanning Day-0 projection → later outcome audits.

---

## 13. Historical outcome data readiness

**Production counts were not executed in this audit** (no live DB access assumed). Aggregate queries below use `uploads.type` prefixes only — no image/PHI export.

```sql
-- Cases with any surgery-day / immediate post-op image
SELECT COUNT(DISTINCT case_id) AS cases_with_surgery_day
FROM uploads
WHERE type IN (
  'patient_photo:day0_recipient',
  'patient_photo:day0_donor',
  'doctor_photo:img_immediate_postop_recipient',
  'doctor_photo:img_immediate_postop_donor',
  'clinic_photo:img_immediate_postop_recipient',
  'clinic_photo:img_immediate_postop_donor',
  'surgery_photo:postop_recipient',
  'surgery_photo:postop_donor'
)
OR type LIKE 'patient_photo:day0_%'
OR type LIKE '%immediate_postop%';

-- Surgery-day + month6 (any view)
WITH surgery AS (
  SELECT DISTINCT case_id FROM uploads
  WHERE type IN (
    'patient_photo:day0_recipient','doctor_photo:img_immediate_postop_recipient',
    'clinic_photo:img_immediate_postop_recipient','surgery_photo:postop_recipient'
  )
),
m6 AS (
  SELECT DISTINCT case_id FROM uploads
  WHERE type LIKE 'patient_photo:postop_month6_%'
     OR type LIKE 'doctor_photo:img_followup_%'  -- coarse; refine in ops
)
SELECT COUNT(*) FROM surgery s JOIN m6 USING (case_id);

-- Surgery-day + month12
-- (same pattern with postop_month12_%)

-- Pre-op + surgery-day + month12
WITH preop AS (
  SELECT DISTINCT case_id FROM uploads
  WHERE type IN ('patient_photo:preop_front','doctor_photo:img_preop_front','clinic_photo:img_preop_front','surgery_photo:preop_recipient')
),
surgery AS ( ... ),
m12 AS ( SELECT DISTINCT case_id FROM uploads WHERE type LIKE 'patient_photo:postop_month12_%' )
SELECT COUNT(*) FROM preop JOIN surgery USING (case_id) JOIN m12 USING (case_id);

-- Known graft count + month12 (JSON paths vary; example on clinical history)
SELECT COUNT(DISTINCT c.id)
FROM cases c
JOIN hairaudit_case_clinical_history h ON h.case_id = c.id
JOIN uploads u ON u.case_id = c.id AND u.type LIKE 'patient_photo:postop_month12_%'
WHERE h.prior_graft_count IS NOT NULL OR h.donor_grafts_removed IS NOT NULL;
-- Also join reports.summary clinic/doctor actual_graft_count via jsonb operators.

-- Procedural scores + month12
SELECT COUNT(DISTINCT r.case_id)
FROM reports r
JOIN uploads u ON u.case_id = r.case_id AND u.type LIKE 'patient_photo:postop_month12_%'
WHERE r.summary -> 'ai' -> 'section_scores' ->> 'overall_score' IS NOT NULL
   OR r.summary -> 'section_scores' ->> 'overall_score' IS NOT NULL;
-- Confirm exact JSON path in a staging sample before production run.
```

**Readiness hypothesis (code-based, not counted):** surgery-day slots are production-required for clinic/doctor and Basic patient sets, so day-0 evidence volume is likely meaningful; month6/12 dedicated keys are mostly **Stage-2 / hidden**, so calibrated projection training pairs may be **sparse** until milestone capture is enforced.

---

## 14. Patient report infrastructure

### Existing stack

| Piece | Path |
|-------|------|
| Print selector | `src/app/api/print/report/route.ts` |
| Post / Pre / Elite HTML | `PostSurgeryAuditReportHtml.tsx`, `PreSurgeryPlanningReportHtml.tsx`, `EliteReportHtml.tsx` |
| PDF orchestration | `renderPdfInternal.ts` |
| Patient-safe summary | `patientSafeSummary.ts` → `PatientSafeReportSummary` |
| Image gallery / signed URLs | `clinicalEvidenceGallery.ts`, elite print photo pipeline |
| Image-limited notice | Flag + banner — **not** a separate mode |
| Surgery evidence PDF | `buildSurgeryEvidenceReviewPdf.ts` — **separate** PDFKit `report_kind` |

### Preferred architecture (confirmed)

```text
Canonical Audit Result
       ↓
Report presentation mode
  ├── Outcome (existing post/pre)
  ├── Image-limited (flag on same model)
  └── Projection (new template branch + summary payload)
```

**Do not** create a third PDF architecture like surgery-evidence. Reuse print → Playwright → storage → `reportAccess` download.

---

## 15. Patient-app readiness (FI-PATIENT-APP / 1E)

**Finding:** No `assessmentType` patient-result abstraction, FI-PATIENT-APP gateway, or 1E DTO exists in `hairaudit-v2`.

Closest abstractions:

| Abstraction | Values |
|-------------|--------|
| `PatientReviewPathway` | `pre_surgery`, `post_surgery` |
| `AuditMode` | patient / doctor / clinic / auditor |
| `PatientSafeReportSummary` | observations, concern bands, imageLimitedNotice |
| Delivery status API | processing / reportReady — not assessment taxonomy |

**Natural mapping if external 1E already has `assessmentType`:**

| HairAudit concept | Suggested assessmentType |
|-------------------|--------------------------|
| Post-surgery outcome | `post_surgery_outcome` |
| Pre-surgery planning | `pre_surgery_planning` |
| Image-limited | same type + `imageLimited: true` |
| Future projection | `surgery_day_projection` / `surgery_day_projection_with_baseline` |

Projection should **emit into** the patient gateway rather than invent a second HairAudit results API — but the gateway contract itself is **out of repo** and must be confirmed in FI-PATIENT-APP.

---

## 16. FiOS / ImagingOS integration opportunity

### Recommended boundaries (confirmed against repo + FIN-IMAGING-1)

| Capability | HairAudit | FiOS | ImagingOS |
| ---------------------- | --------: | ---: | --------: |
| Evidence requirements / policy | ✓ | | |
| View classification | | bridge | ✓ |
| Quality / protocol | | bridge | ✓ |
| Recipient segmentation | | | **new** |
| Site detection | | | **new** |
| Hairline geometry | | | **new** |
| Procedure metadata | ✓ (canonical store) | optional sync | |
| Outcome history / cohorts | | ✓ (longitudinal) | features in |
| Projection / outcome model | presentation | ✓ | features out |
| Patient-safe report | ✓ | | |
| Clinical interpretation / disclaimers | ✓ | | |

```text
ImagingOS  = extracts objective visual features
FiOS       = longitudinal intelligence + cohort/outcome projection
HairAudit  = evidence policy + clinical interpretation + patient-safe report
```

This matches FIN-IMAGING-1 direction (FI OS HIE/ImagingOS as classifier/feature authority; products keep images locally). HairAudit should **not** grow a parallel CV stack.

---

## 17. Dormant / unfinished foundation

| Item | Path | Status | Projection relevance |
|------|------|--------|----------------------|
| HA-INTELLIGENCE engines “Await ImagingOS” | `src/lib/hairaudit-intelligence/*` | Wired as advisory placeholders | High — schema-shaped stubs |
| Clinical image model hook returns null | `classifyClinicalHairImageFromModelUrl.ts` | Placeholder | High gap |
| FI classifier default dry_run | `fiImageClassifierAdapter.ts` | Env-gated | High for inputs |
| Platform “Outcome Prediction Engine” 58% | `platformProgress.ts` | Marketing only | False confidence |
| Landing `DensityMapGrid` hardcoded | `SampleAuditReportSection.tsx` | Demo only | False confidence |
| Elite Predictive Outlook | `EliteReportHtml.tsx` | Legacy/elite narrative | High risk if reused naively |
| Surgical fingerprint | `surgicalFingerprint.ts` | Elite path only | Qualitative reuse |
| Follow-up timeline | `followupTimelineFromPatientUploads.ts` | Coverage, not compare | Medium scaffold |
| Intelligence snapshots table | migration `20260621120000_*` | Optional persist | Could store projection snapshots later |
| AuditOS scoring Stage 4A | `auditos/scoring/types.ts` | Structural placeholder | Low |
| Core DDL placeholder | `docs/sql/hairaudit-core-forensic-baseline-placeholder.sql` | **DO NOT APPLY** | Schema debt, not projection |
| ImagingOS / VIE / scalpImageComparison | FI OS / docs only | Not in this repo | External dependency |
| HA-PROJECTION code/migrations | — | **None** | Greenfield product surface |

---

## 18. Foundation maturity matrix

| Capability | Score 0–4 |
| -------------------------------- | --------: |
| Surgery-day evidence recognition | 3 |
| Pre-op baseline | 3 |
| Recipient view classification | 3 |
| Donor view classification | 3 |
| Hairline analysis | 2 |
| Recipient zoning | 2 |
| Graft/site counting | 1 |
| Density estimation | 1 |
| Direction/angulation | 2 |
| Donor extraction analysis | 2 |
| Native-hair integration | 1 |
| Procedure metadata | 3 |
| Stage logic | 2 |
| Longitudinal comparisons | 1 |
| Outcome history | 1 |
| Patient-safe result DTO | 2 |
| PDF/report rendering | 4 |
| ImagingOS integration | 2 |
| FiOS longitudinal storage | 1 |

**Scale:** 0 absent · 1 concept/docs · 2 partial · 3 production needing extension · 4 essentially reusable

---

## 19. Gap classification (basis for HA-PROJECTION-1)

### A — Reuse as-is

- Explicit surgery-day / immediate-post-op upload keys (patient, clinic, surgery portal)
- Pre-op baseline keys
- `PatientSafeReportSummary` + disclaimer patterns
- Print/PDF pipeline (Post/Pre/Elite branch pattern)
- Forensic AI observed section scores + key findings (as surgery-day feature language)
- Clinical history patient-safe lines builder
- Milestone photo key taxonomy (for future compare targets)

### B — Extend existing capability

- Unify three surgery-day taxonomies into projection evidence policy (avoid `any_day0` as primary)
- Stage/pathway model: surgery-day assessment kind or stage without inventing Zone 1–4
- Persist observed procedural features from AI findings as structured Day-0 feature set
- Report mode: Projection branch on same canonical result
- Alias zone vocabularies to one projection zone list
- Wire FiOS classifier cutover for reliable category/quality on day-0 uploads
- Report/assessment lineage for Day-0 projection ↔ later outcome reports

### C — New ImagingOS capability

- Recipient / donor segmentation
- Implantation / extraction site detection
- Hairline geometry (landmarks, symmetry, irregularity metrics)
- Calibrated density / sites/cm² (if scale available)
- Within-image anatomical features beyond view class

### D — New FiOS intelligence

- Bounded projected cosmetic outcome model (cohort-calibrated)
- Longitudinal projected-vs-observed comparison at 3/6/9/12
- Outcome history / twin linkage across assessments
- Native Hair Dependency modelling (placement vs progressive native loss + meds)

### E — New HairAudit presentation/policy

- Evidence requirements for projection (day-0 only vs day-0 + baseline)
- Patient-safe projection copy (no forbidden patient terms)
- Confidence / image-limited banners for projection
- Disclaimers: bounded estimate, not guarantee
- Optional `assessmentType` emission to FI-PATIENT-APP 1E
- Auditor review/unlock policy for projection reports

---

## 20. Architecture map (current)

```text
                    ┌─────────────────────────────────────┐
                    │         Evidence capture             │
                    │  patient_photo / clinic_photo /      │
                    │  surgery_photo (3 taxonomies)        │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     FiOS classify          OpenAI forensic        Forms / clinical
     (view+quality)         audit (scores)         history metadata
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
                        reports.summary (+ pathway models)
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              Patient-safe    Post/Pre PDF    Elite / surgery
              summary         Playwright      evidence PDFKit
```

**Missing for Projection:** ImagingOS feature layer → FiOS projection model → HairAudit Projection report mode + lineage to month N outcomes.

---

## Appendix A — Duplicate / conflicting systems (canonical preference)

| Conflict | Prefer for Projection |
|----------|----------------------|
| `day0_*` vs `img_immediate_postop_*` vs surgery `postop_*` | All three accepted; normalize to internal evidence roles `surgery_day_recipient` / `surgery_day_donor` |
| `any_day0` bucket | Fallback only |
| `preop_*` meaning “current” on post_surgery pathway | Require true pre-op provenance for baseline mode |
| Multiple procedure_type meanings | Map explicitly per layer |
| Zone lists across forms/clinical/AI | Align to `masterSurgicalMetadata` + clinical history |

---

## Appendix B — Documented-only vs production

| Claim | Label |
|-------|-------|
| Upload → FI worker → metadata write-back | Production (env-gated) |
| Unified FiOS classifier adapter | Production staging cutover |
| Live ImagingOS anatomical analytics in HairAudit | Documented / placeholder |
| OpenAI forensic audit + GII | Production |
| HA-INTELLIGENCE four engines | Production code, placeholder logic |
| Outcome Prediction Engine % on progress page | Documented / marketing only |
| Density maps in patient reports | Marketing mock only |
| FI-PATIENT-APP assessmentType in this repo | Absent |
| Core cases/reports/uploads baseline DDL file | Documented-only placeholder |

---

*End of HA-PROJECTION-0 foundation audit. No implementation performed.*
