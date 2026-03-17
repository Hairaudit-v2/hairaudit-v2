export const PLATFORM = {
  FI_NAME: "Follicle Intelligence",
  HA_NAME: "HairAudit",
  HLI_NAME: "Hair Longevity Institute",
  IIOHR_NAME: "IIOHR",
  FI_URL: "https://follicleintelligence.ai",
  HA_URL: "https://www.hairaudit.com",
  HLI_URL: "https://hairlongevityinstitute.com",
  /** Update when IIOHR public site is available */
  IIOHR_URL: "https://iiohr.org",
} as const;

/** Footer band: Part of the Surgical Intelligence Ecosystem™ — same order and labels across all platforms */
export const SURGICAL_ECOSYSTEM_FOOTER = [
  { label: PLATFORM.IIOHR_NAME, tag: "Training", url: PLATFORM.IIOHR_URL },
  { label: PLATFORM.HA_NAME, tag: "Measurement", url: PLATFORM.HA_URL },
  { label: PLATFORM.FI_NAME, tag: "Analysis", url: PLATFORM.FI_URL },
  { label: PLATFORM.HLI_NAME, tag: "Biology", url: PLATFORM.HLI_URL },
] as const;

export const PLATFORM_ECOSYSTEM = [
  {
    key: "follicleIntelligence",
    name: PLATFORM.FI_NAME,
    subtitle: "Clinical Intelligence Platform",
    url: PLATFORM.FI_URL,
  },
  {
    key: "hairAudit",
    name: PLATFORM.HA_NAME,
    subtitle: "Hair Transplant Audit System",
    url: PLATFORM.HA_URL,
  },
] as const;
