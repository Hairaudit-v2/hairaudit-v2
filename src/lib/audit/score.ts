// src/lib/audit/score.ts
//
// Draft-friendly scoring with medico-legal defensibility:
// - If missing_answer_policy = "exclude_from_section": unanswered questions are excluded.
//   If a whole section has no scored answers, that section is excluded from domain rollups.
//   If a whole domain has no scored sections, that domain is excluded from overall rollup.
//   Overall is normalized by the total weight of domains that actually contributed.
//   Confidence still drops sharply with missing required answers.
// - If missing_answer_policy = "treat_as_zero": unanswered questions count as 0 and still consume weight.
//
// This prevents "draft audits" from collapsing to ~0/100 just because most answers are null,
// while keeping confidence low until the audit is complete.

type Rubric = {
  rubric_id: string
  version: number
  title: string
  scoring_model: {
    domain_weight_total: number
    section_weight_total_per_domain: number
    question_weight_total_per_section: number
    normalization: "to_100"
    missing_answer_policy: "exclude_from_section" | "treat_as_zero"
    rounding?: { domain?: number; section?: number; overall?: number }
  }
  scale_library?: Record<
    string,
    {
      range: [number, number]
      anchors?: Record<string, string>
    }
  >
  domains: Domain[]
  grade_schemes: {
    active_scheme: string
    [scheme: string]:
      | string
      | {
          bands: { min: number; label: string }[]
        }
  }
  confidence_model?: {
    inputs: { id: string; weight: number; description?: string }[]
    bands: { min: number; label: "high" | "medium" | "low" | string }[]
  }
}

type Domain = {
  domain_id: string
  title: string
  weight: number
  sections: Section[]
}

type Section = {
  section_id: string
  title: string
  weight: number
  questions: Question[]
}

type Question = {
  question_id: string
  prompt: string
  type: "scale" | "yesno" | "percent_banded" | "select" | "text"
  weight: number
  required?: boolean
  scale_ref?: string
  scale?: { range: [number, number]; anchors?: Record<string, string> }
  scoring?: { bands?: { max: number; score: number }[] }
  options?: { value: string; label?: string; score: number }[]
  evidence?: { min_items?: number; types?: string[] }
}

type Answer = {
  value?: number | boolean | string
  notes?: string
  evidence_ids?: string[]
  source?: "manual" | "ai" | "mixed"
  ai?: {
    model?: string
    confidence?: number
    rationale?: string
    prompt_hash?: string
  }
}

type Answers = Record<string, Record<string, Answer>>

export type ScoreOutput = {
  rubric: { rubric_id: string; version: number; title: string }
  component_scores: { domains: Record<string, number>; sections: Record<string, number> }
  overall_score: number
  grade: string
  confidence: string
  confidence_factors: {
    answer_completeness: number
    evidence_coverage: number
    source_mix: number
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function roundTo(n: number, dp: number) {
  const m = Math.pow(10, dp)
  return Math.round(n * m) / m
}

function normalizeScale(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return null
  if (max <= min) return null
  const v = clamp(value, min, max)
  return ((v - min) / (max - min)) * 100
}

function normalizeYesNo(value: boolean) {
  return value ? 100 : 0
}

function normalizePercentBanded(value: number, bands: { max: number; score: number }[]) {
  if (!Number.isFinite(value)) return null
  for (const b of bands) {
    if (value <= b.max) return b.score
  }
  return 0
}

function normalizeSelect(value: string, options: { value: string; score: number }[]) {
  const opt = options.find((o) => o.value === value)
  return opt ? clamp(opt.score, 0, 100) : null
}

function pickScale(question: Question, rubric: Rubric): [number, number] | null {
  if (question.scale?.range) return question.scale.range
  if (question.scale_ref && rubric.scale_library?.[question.scale_ref]?.range) {
    return rubric.scale_library[question.scale_ref].range
  }
  return null
}

function getGrade(rubric: Rubric, overall: number) {
  const active = rubric.grade_schemes.active_scheme
  const scheme = rubric.grade_schemes[active] as any
  const bands: { min: number; label: string }[] = scheme?.bands ?? []
  const sorted = [...bands].sort((a, b) => b.min - a.min)
  for (const b of sorted) {
    if (overall >= b.min) return b.label
  }
  return "Unrated"
}

export function scoreAudit(rubric: Rubric, answers: Answers): ScoreOutput {
  const rounding = {
    domain: rubric.scoring_model.rounding?.domain ?? 1,
    section: rubric.scoring_model.rounding?.section ?? 1,
    overall: rubric.scoring_model.rounding?.overall ?? 1
  }

  const policy = rubric.scoring_model.missing_answer_policy

  const domainScores: Record<string, number> = {}
  const sectionScores: Record<string, number> = {}

  // Confidence factors
  let requiredQuestionsTotal = 0
  let requiredQuestionsAnswered = 0

  let evidenceRequiredTotal = 0
  let evidenceRequiredMet = 0

  // Source mix: manual > mixed > ai
  let answeredCount = 0
  let manualCount = 0
  let mixedCount = 0
  let aiCount = 0

  function hasUsableValue(a: Answer | null) {
    if (!a) return false
    if (a.value === undefined || a.value === null) return false
    if (typeof a.value === "string" && a.value.trim() === "") return false
    return true
  }

  // Helper: answers keyed by section_id (recommended), with domain_id fallback
  function getAnswer(sectionId: string, domainId: string, questionId: string): Answer | null {
    return answers?.[sectionId]?.[questionId] ?? answers?.[domainId]?.[questionId] ?? null
  }

  // Overall weighted average across domains that actually contribute
  let overallAccumulator = 0
  let overallWeightUsed = 0

  for (const domain of rubric.domains) {
    // Domain is weighted average of scored section scores
    let domainAccumulator = 0
    let domainWeightUsed = 0

    for (const section of domain.sections) {
      // Section score is weighted average of scored/normalized questions
      let sectionSum = 0
      let usedWeightSum = 0

      for (const q of section.questions) {
        const isRequired = Boolean(q.required)
        if (isRequired) requiredQuestionsTotal += 1

        const a = getAnswer(section.section_id, domain.domain_id, q.question_id)
        const hasAnswer = hasUsableValue(a)

        if (isRequired && hasAnswer) requiredQuestionsAnswered += 1

        // Evidence coverage (only count if required OR explicitly asks for evidence)
        const minItems = q.evidence?.min_items ?? 0
        const evidenceIsExpected = isRequired || minItems > 0
        if (evidenceIsExpected) {
          evidenceRequiredTotal += 1
          const evCount = Array.isArray(a?.evidence_ids) ? a!.evidence_ids!.length : 0
          const met = minItems > 0 ? evCount >= minItems : evCount > 0
          if (met) evidenceRequiredMet += 1
        }

        // Source mix tracking
        if (hasAnswer) {
          answeredCount += 1
          const src = a?.source ?? "manual"
          if (src === "manual") manualCount += 1
          else if (src === "mixed") mixedCount += 1
          else if (src === "ai") aiCount += 1
        }

        // Text questions don't contribute to scoring
        if (q.type === "text") continue

        // Missing answer policy
        if (!hasAnswer) {
          if (policy === "treat_as_zero") {
            usedWeightSum += q.weight
          }
          continue
        }

        let normalized: number | null = null

        if (q.type === "scale") {
          const range = pickScale(q, rubric)
          if (range) normalized = normalizeScale(Number(a!.value), range[0], range[1])
        } else if (q.type === "yesno") {
          normalized = normalizeYesNo(Boolean(a!.value))
        } else if (q.type === "percent_banded") {
          const bands = q.scoring?.bands ?? []
          normalized = normalizePercentBanded(Number(a!.value), bands)
        } else if (q.type === "select") {
          const options = q.options ?? []
          normalized = normalizeSelect(String(a!.value), options)
        }

        // If can't normalize, treat as missing by policy
        if (normalized === null) {
          if (policy === "treat_as_zero") {
            usedWeightSum += q.weight
          }
          continue
        }

        usedWeightSum += q.weight
        sectionSum += normalized * (q.weight / 100)
      }

      // If no scored weight was used:
      // - exclude_from_section => sectionScore is null (do not roll up)
      // - treat_as_zero => sectionScore is 0 (roll up as 0 with section weight)
      let sectionScore: number | null = null
      if (usedWeightSum > 0) {
        sectionScore = sectionSum / (usedWeightSum / 100)
      } else {
        sectionScore = policy === "treat_as_zero" ? 0 : null
      }

      if (sectionScore === null) {
        // Not enough info yet; don't include in rollups
        continue
      }

      const sectionScoreRounded = roundTo(sectionScore, rounding.section)
      sectionScores[section.section_id] = sectionScoreRounded

      // Domain rollup uses only sections that contributed
      domainAccumulator += sectionScore * (section.weight / 100)
      domainWeightUsed += section.weight
    }

    // If domain has no contributing sections:
    // - treat_as_zero => domainScore becomes 0 and still contributes to overall
    // - exclude_from_section => domainScore is null and does not contribute to overall
    let domainScore: number | null = null
    if (domainWeightUsed > 0) {
      domainScore = domainAccumulator / (domainWeightUsed / 100)
    } else {
      domainScore = policy === "treat_as_zero" ? 0 : null
    }

    if (domainScore === null) {
      // No scored sections in this domain yet
      domainScores[domain.domain_id] = 0
      continue
    }

    const domainScoreRounded = roundTo(domainScore, rounding.domain)
    domainScores[domain.domain_id] = domainScoreRounded

    overallAccumulator += domainScore * (domain.weight / 100)
    overallWeightUsed += domain.weight
  }

  // Normalize overall by the weight actually used (only matters for exclude_from_section draft flow)
  let overall =
    overallWeightUsed > 0 ? overallAccumulator / (overallWeightUsed / 100) : 0

  overall = roundTo(overall, rounding.overall)

  const grade = getGrade(rubric, overall)

  // Confidence factors
  const answer_completeness =
    requiredQuestionsTotal > 0 ? requiredQuestionsAnswered / requiredQuestionsTotal : 0

  const evidence_coverage =
    evidenceRequiredTotal > 0 ? evidenceRequiredMet / evidenceRequiredTotal : 0

  // source_mix scoring: manual=1, mixed=0.75, ai=0.5 (tweakable later)
  const source_mix =
    answeredCount > 0
      ? (manualCount * 1 + mixedCount * 0.75 + aiCount * 0.5) / answeredCount
      : 0

  // Compute confidence_score using rubric weights if present; else default balanced
  const cm = rubric.confidence_model
  const weights = cm?.inputs ?? [
    { id: "answer_completeness", weight: 0.45 },
    { id: "evidence_coverage", weight: 0.45 },
    { id: "source_mix", weight: 0.10 }
  ]

  const factorMap: Record<string, number> = {
    answer_completeness,
    evidence_coverage,
    source_mix
  }

  let confidenceScore = 0
  let weightSum = 0
  for (const w of weights) {
    const v = factorMap[w.id]
    if (typeof v === "number") {
      confidenceScore += v * w.weight
      weightSum += w.weight
    }
  }
  confidenceScore = weightSum > 0 ? confidenceScore / weightSum : 0

  let confidence = "medium"
  const bands = cm?.bands ?? [
    { min: 0.8, label: "high" },
    { min: 0.55, label: "medium" },
    { min: 0.0, label: "low" }
  ]
  for (const b of [...bands].sort((a, b) => b.min - a.min)) {
    if (confidenceScore >= b.min) {
      confidence = b.label
      break
    }
  }

  return {
    rubric: {
      rubric_id: rubric.rubric_id,
      version: rubric.version,
      title: rubric.title
    },
    component_scores: {
      domains: domainScores,
      sections: sectionScores
    },
    overall_score: overall,
    grade,
    confidence,
    confidence_factors: {
      answer_completeness: roundTo(answer_completeness, 3),
      evidence_coverage: roundTo(evidence_coverage, 3),
      source_mix: roundTo(source_mix, 3)
    }
  }
}
