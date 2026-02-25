export function buildRubricTitles(rubric: {
  domains?: { domain_id: string; title: string; sections?: { section_id: string; title: string }[] }[];
}): { domainTitles: Record<string, string>; sectionTitles: Record<string, string> } {
  const domainTitles: Record<string, string> = {};
  const sectionTitles: Record<string, string> = {};
  for (const d of rubric?.domains ?? []) {
    domainTitles[d.domain_id] = d.title;
    for (const s of d.sections ?? []) {
      sectionTitles[s.section_id] = s.title;
    }
  }
  return { domainTitles, sectionTitles };
}

