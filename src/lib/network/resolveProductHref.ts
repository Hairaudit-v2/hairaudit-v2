import type { NetworkProductSlug } from "@/packages/ui";

import { PLATFORM } from "@/lib/constants/platform";

/**
 * Environment-safe URLs for Follicle Intelligence Network product surfaces.
 * On HairAudit, the current product resolves to the site root.
 */
export function resolveProductHref(slug: NetworkProductSlug): string {
  const hrefs: Record<NetworkProductSlug, string> = {
    hairaudit: "/",
    "follicle-intelligence": PLATFORM.FI_URL,
    hli: PLATFORM.HLI_URL,
    iiohr: PLATFORM.IIOHR_URL,
  };
  return hrefs[slug];
}
