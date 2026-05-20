import type { DevelopmentalLevel } from "./types";

export const DEVELOPMENTAL_LEVELS = [
  "needs_faculty_support",
  "developing",
  "competent_for_stage",
  "strong",
  "advanced_trainee",
] as const;

export const DEVELOPMENTAL_LEVEL_LABELS: Record<DevelopmentalLevel, string> = {
  needs_faculty_support: "Needs faculty support",
  developing: "Developing",
  competent_for_stage: "Competent for training stage",
  strong: "Strong",
  advanced_trainee: "Advanced trainee performance",
};

export const CASE_DIFFICULTY_OPTIONS = ["straightforward", "moderate", "complex", "high_complexity"] as const;

export const CASE_DIFFICULTY_LABELS: Record<(typeof CASE_DIFFICULTY_OPTIONS)[number], string> = {
  straightforward: "Straightforward",
  moderate: "Moderate",
  complex: "Complex",
  high_complexity: "High complexity",
};

export const REVIEW_DISCLAIMER =
  "This review is designed to support surgical learning and skill progression. Feedback is based on the training context, case difficulty, image evidence, and faculty observations. This is not a formal independent HairAudit report. The purpose is to identify strengths, refine technique, and guide the next supervised case.";

export const IMAGE_QUALITY_LEVELS = [
  "adequate_for_review",
  "partially_obscured",
  "needs_better_documentation",
] as const;

export const IMAGE_QUALITY_LABELS: Record<(typeof IMAGE_QUALITY_LEVELS)[number], string> = {
  adequate_for_review: "Adequate for review",
  partially_obscured: "Partially obscured",
  needs_better_documentation: "Needs better documentation",
};

export function isDevelopmentalLevel(v: unknown): v is DevelopmentalLevel {
  return typeof v === "string" && (DEVELOPMENTAL_LEVELS as readonly string[]).includes(v);
}

export function parseStringList(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const out = raw.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : null;
  }
  if (typeof raw === "string") {
    const out = raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return out.length ? out : null;
  }
  return null;
}
