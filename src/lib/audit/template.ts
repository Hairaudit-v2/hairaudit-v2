type AnyRubric = {
  domains: Array<{
    domain_id: string
    sections: Array<{
      section_id: string
      questions: Array<{
        question_id: string
        type?: string
      }>
    }>
  }>
}

export function buildEmptyAnswers(rubric: AnyRubric) {
  if (!rubric || !Array.isArray(rubric.domains)) {
    throw new Error("buildEmptyAnswers: invalid rubric passed in (missing domains)")
  }

  const answers: Record<string, Record<string, any>> = {}

  for (const domain of rubric.domains) {
    for (const section of domain.sections) {
      answers[section.section_id] = answers[section.section_id] || {}
      for (const q of section.questions) {
        answers[section.section_id][q.question_id] = {
          value: null,
          notes: "",
          evidence_ids: [],
          source: "manual"
        }
      }
    }
  }

  return answers
}
