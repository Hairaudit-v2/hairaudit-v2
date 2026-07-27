/**
 * FI-OUTCOME-INTELLIGENCE-1F — Central fixture scenario manifest.
 * Do not scatter fixture details across Playwright specs.
 */

import type { LongitudinalFixtureManifestEntry } from "./types";

export const LONGITUDINAL_FIXTURE_MANIFEST: readonly LongitudinalFixtureManifestEntry[] =
  [
    {
      fixtureKey: "FRONTAL",
      displayName: "E2E Projection Frontal",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-due",
      seedReferenceFront: true,
      notes: "A — frontal-only Month 6 due",
    },
    {
      fixtureKey: "CROWN",
      displayName: "E2E Projection Crown",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal", "crown"],
      focusStage: "month_6",
      mode: "seed-to-incomplete",
      existingUploadRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
      ],
      notes: "B — crown required; crown omitted keeps incomplete",
    },
    {
      fixtureKey: "RECOMMENDED-SKIP",
      displayName: "E2E Projection Recommended Skip",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-ready",
      notes: "C — required complete; recommended donor absent",
    },
    {
      fixtureKey: "RESUME",
      displayName: "E2E Projection Resume",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-incomplete",
      existingUploadRoles: ["followup_front", "followup_top"],
      notes: "D — resume at recipient close-up",
    },
    {
      fixtureKey: "REPLACE",
      displayName: "E2E Projection Replace",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-incomplete",
      existingUploadRoles: ["followup_front"],
      notes: "E — replace front upload",
    },
    {
      fixtureKey: "MISSED-M6",
      displayName: "E2E Projection Missed M6",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_9",
      anchorStageForWindow: "month_9",
      mode: "seed-to-due",
      notes: "F — Month 6 missed; Month 9 due",
    },
    {
      fixtureKey: "BASELINE-PLUS",
      displayName: "E2E Projection Baseline Plus",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_12",
      mode: "seed-to-observed",
      seedComparison: true,
      notes: "G — baseline-aware Month 12 observed/review",
    },
    {
      fixtureKey: "SURGERY-ONLY",
      displayName: "E2E Projection Surgery Only",
      projectionMode: "surgery_day_only",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_12",
      mode: "seed-to-observed",
      seedComparison: true,
      notes: "H — surgery-day-only projection",
    },
    {
      fixtureKey: "REMINDER",
      displayName: "E2E Projection Reminder",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-due",
      seedEngagement: true,
      notes: "I — reminder deep-link",
    },
    {
      fixtureKey: "STALE-REMINDER",
      displayName: "E2E Projection Stale Reminder",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-due",
      seedEngagement: true,
      notes: "J — engagement then complete → revalidate suppress",
    },
    {
      fixtureKey: "FULL-LOOP",
      displayName: "E2E Projection Full Loop",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_12",
      mode: "seed-to-ready",
      seedReferenceFront: true,
      notes: "K — ready → observation → comparison → review",
    },
    {
      fixtureKey: "ISOLATION-A",
      displayName: "E2E Projection Isolation A",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-due",
      notes: "Cross-patient isolation patient A",
    },
    {
      fixtureKey: "ISOLATION-B",
      displayName: "E2E Projection Isolation B",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_6",
      mode: "seed-to-due",
      notes: "Cross-patient isolation patient B",
    },
    {
      fixtureKey: "HISTORICAL",
      displayName: "E2E Projection Historical",
      projectionMode: "baseline_plus",
      treatedAreas: ["hairline", "frontal"],
      focusStage: "month_12",
      mode: "seed-to-observed",
      seedComparison: true,
      notes: "Historical lineage P1/O1/C1 before supersession",
    },
  ] as const;

export function getManifestEntry(fixtureKey: string) {
  const key = String(fixtureKey).toUpperCase().replace(/^FI-OI-1F-/, "");
  return (
    LONGITUDINAL_FIXTURE_MANIFEST.find((e) => e.fixtureKey === key) ?? null
  );
}
