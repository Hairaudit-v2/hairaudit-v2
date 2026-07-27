/**
 * FI-OUTCOME-INTELLIGENCE-1A — Governance status for de-identified cohort analytics.
 *
 * Does not invent legal conclusions. Status is derived from documented repo basis
 * plus explicit operator approval env.
 */

export type CohortGovernanceStatus =
  | "APPROVED_EXISTING_BASIS"
  | "NEEDS_POLICY_CONFIRMATION"
  | "BLOCKED";

export type CohortGovernanceFinding = {
  status: CohortGovernanceStatus;
  summary: string;
  repoBasis: string[];
  productionActivationRequires: string[];
};

/**
 * Repo review (1A):
 * - FUTURE-INTEGRATION-ARCHITECTURE.md positions FI as analytics consumer of
 *   normalized signals — not an explicit patient consent basis for longitudinal
 *   outcome cohort materialization.
 * - HA-PROJECTION-1F evidence defers cohort analytics to FiOS without confirming
 *   terms-of-use coverage.
 * - No patient Terms/Privacy clause in-repo explicitly authorizes de-identified
 *   outcome product-improvement analytics.
 *
 * Therefore: NEEDS_POLICY_CONFIRMATION until FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true
 * is set by an operator after legal/policy confirmation.
 */
export function evaluateCohortGovernance(args?: {
  governanceApprovedEnv?: boolean;
}): CohortGovernanceFinding {
  const repoBasis = [
    "docs/FUTURE-INTEGRATION-ARCHITECTURE.md — FI as analytics consumer of normalized events (architectural intent only).",
    "docs/hairaudit/audits/HA-PROJECTION-1F-projected-vs-observed-comparison.md — defers FiOS cohort aggregation; does not grant consent.",
    "No in-repo Terms/Privacy clause confirming de-identified longitudinal outcome analytics for product improvement.",
  ];

  if (args?.governanceApprovedEnv === true) {
    return {
      status: "APPROVED_EXISTING_BASIS",
      summary:
        "Operator set FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true after external policy confirmation. Repo alone does not constitute legal approval.",
      repoBasis,
      productionActivationRequires: [
        "FI_OUTCOME_COHORT_ENABLED=true",
        "FI_OUTCOME_COHORT_HMAC_SECRET set",
        "FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true",
      ],
    };
  }

  return {
    status: "NEEDS_POLICY_CONFIRMATION",
    summary:
      "De-identified outcome cohort analytics are architecturally anticipated but not confirmed by in-repo consent/policy text. Production materialization remains fail-closed until explicit governance approval.",
    repoBasis,
    productionActivationRequires: [
      "Confirm Terms/Privacy or DPA covers de-identified outcome product-improvement analytics",
      "Set FI_OUTCOME_COHORT_GOVERNANCE_APPROVED=true",
      "Set FI_OUTCOME_COHORT_ENABLED=true",
      "Set FI_OUTCOME_COHORT_HMAC_SECRET",
    ],
  };
}
