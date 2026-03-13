type ScoreInput = {
  photoCount: number;
  monthsSinceProcedure: number | null;
  concernLevel: "low" | "medium" | "high";
};

export type HairAuditScoreSummary = {
  hairlineDesign: number;
  density: number;
  donorPreservation: number;
  naturalness: number;
  overall: number;
  summary: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function concernPenalty(level: ScoreInput["concernLevel"]) {
  if (level === "high") return 6;
  if (level === "medium") return 3;
  return 0;
}

export function buildHairAuditScore(input: ScoreInput): HairAuditScoreSummary {
  const photoCoverage = clamp(input.photoCount * 4, 0, 24);
  const maturity =
    input.monthsSinceProcedure == null
      ? 3
      : input.monthsSinceProcedure >= 12
        ? 8
        : input.monthsSinceProcedure >= 9
          ? 6
          : input.monthsSinceProcedure >= 6
            ? 4
            : 2;

  const penalty = concernPenalty(input.concernLevel);
  const baseline = clamp(58 + photoCoverage + maturity - penalty, 40, 95);

  const hairlineDesign = clamp(baseline + 2, 35, 98);
  const density = clamp(baseline - 1, 35, 98);
  const donorPreservation = clamp(baseline + 1, 35, 98);
  const naturalness = clamp(baseline, 35, 98);
  const overall = Math.round((hairlineDesign + density + donorPreservation + naturalness) / 4);

  const summary =
    overall >= 85
      ? "Strong quality signals with good design balance and reassuring evidence coverage."
      : overall >= 70
        ? "Generally positive quality indicators with some areas that benefit from ongoing monitoring."
        : overall >= 55
          ? "Mixed indicators. A deeper review may help clarify long-term quality confidence."
          : "Limited quality confidence from the provided evidence. Full clinical review is recommended.";

  return { hairlineDesign, density, donorPreservation, naturalness, overall, summary };
}

export function toCommunityScore100(params: {
  naturalnessAvg: number | null;
  densityAvg: number | null;
  hairlineAvg: number | null;
}) {
  const values = [params.naturalnessAvg, params.densityAvg, params.hairlineAvg].filter(
    (v): v is number => typeof v === "number"
  );
  if (!values.length) return null;
  const avg5 = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round((avg5 / 5) * 100);
}
