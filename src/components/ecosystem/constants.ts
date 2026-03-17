/**
 * Global Hair Intelligence Network — shared constants.
 * Canonical source for default node links; can be overridden per site.
 */

export type NetworkVariant = "hli" | "hairaudit" | "fi" | "iiohr";

export type NodeLinks = {
  hli: string;
  hairaudit: string;
  fi: string;
  iiohr: string;
};

export const DEFAULT_NODE_LINKS: NodeLinks = {
  hli: "https://hairlongevityinstitute.com",
  hairaudit: "https://hairaudit.com",
  fi: "https://follicleintelligence.ai",
  iiohr: "https://iiohr.com",
} as const;

export const NODE_LABELS = {
  hli: "Hair Longevity Institute",
  hairaudit: "HairAudit",
  fi: "Follicle Intelligence",
  iiohr: "IIOHR",
} as const;
