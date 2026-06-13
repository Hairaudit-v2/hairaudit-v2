import { networkButtonVariants } from "./network-ui";

import { cn } from "@/lib/utils";

/** Matches `NetworkButton` primary hover affordance for the HairAudit platform. */
export function fiHairauditPrimaryButtonClass(size: "sm" | "md" | "lg" = "md") {
  return cn(
    networkButtonVariants({ variant: "primary", size }),
    "hover:border-sky-400/25 hover:shadow-[0_18px_48px_rgb(56_189_248_/0.12)]"
  );
}
