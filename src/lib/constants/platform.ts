export const PLATFORM = {
  FI_NAME: "Follicle Intelligence",
  HA_NAME: "HairAudit",
  FI_URL: "https://www.follicleintelligence.com",
  HA_URL: "https://www.hairaudit.com",
} as const;

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
