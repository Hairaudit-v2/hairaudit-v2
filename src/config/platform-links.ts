import { PLATFORM } from "@/lib/constants/platform";

export const PLATFORM_LINKS = {
  follicleIntelligence: PLATFORM.FI_URL,
  hairAudit: PLATFORM.HA_URL,
} as const;

export const FI_HOME = PLATFORM_LINKS.follicleIntelligence;
export const HA_HOME = PLATFORM_LINKS.hairAudit;
