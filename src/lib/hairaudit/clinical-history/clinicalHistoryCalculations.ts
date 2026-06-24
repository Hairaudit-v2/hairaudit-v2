/** Deterministic graft/hair/ratio calculations for the Clinical Intelligence Editor. */

export function calculateAverageHairsPerGraft(
  totalGrafts: number,
  estimatedHairs: number
): number | null {
  if (!Number.isFinite(totalGrafts) || !Number.isFinite(estimatedHairs)) return null;
  if (totalGrafts <= 0 || estimatedHairs <= 0) return null;
  return Math.round((estimatedHairs / totalGrafts) * 100) / 100;
}

export type GraftDistributionTotals = {
  totalGrafts: number;
  estimatedHairs: number;
  averageHairsPerGraft: number;
};

export function calculateFromGraftDistribution(
  singles: number,
  doubles: number,
  triples: number,
  quadruples: number
): GraftDistributionTotals | null {
  if (![singles, doubles, triples, quadruples].every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }
  const hasAny = singles > 0 || doubles > 0 || triples > 0 || quadruples > 0;
  if (!hasAny) return null;

  const totalGrafts = singles + doubles + triples + quadruples;
  const estimatedHairs = singles * 1 + doubles * 2 + triples * 3 + quadruples * 4;
  const averageHairsPerGraft = calculateAverageHairsPerGraft(totalGrafts, estimatedHairs);
  if (averageHairsPerGraft == null) return null;

  return { totalGrafts, estimatedHairs, averageHairsPerGraft };
}

export function parseOptionalPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function parseOptionalNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}
