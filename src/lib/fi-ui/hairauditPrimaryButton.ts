import { networkButtonVariants } from "./network-ui";

import { cn } from "@/lib/utils";

const primarySizeClasses = {
  sm: "h-9 rounded-md px-3 text-xs",
  md: "h-10 rounded-md px-5 text-sm",
  lg: "min-h-11 rounded-lg px-7 text-sm sm:text-[0.95rem]",
} as const;

/**
 * HairAudit primary CTA — gold fill, dark readable label.
 * Built without the shared network glass "primary" so public CTAs never look muted/disabled.
 */
export function fiHairauditPrimaryButtonClass(size: "sm" | "md" | "lg" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "transition-[transform,box-shadow,colors,border-color]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    primarySizeClasses[size],
    "border border-amber-400/60 bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20",
    "hover:-translate-y-0.5 hover:border-amber-400/80 hover:bg-amber-400",
    "hover:shadow-[0_18px_48px_rgb(245_158_11_/0.28)]"
  );
}

/**
 * HairAudit secondary CTA — dark/transparent surface, visible border, high-contrast label.
 * Distinct from primary; never identical to the gold Pathway A treatment.
 */
export function fiHairauditSecondaryButtonClass(size: "sm" | "md" | "lg" = "md") {
  return cn(
    networkButtonVariants({ variant: "secondary", size }),
    "min-w-[12rem] border-white/30 bg-transparent text-white backdrop-blur-none",
    "hover:border-amber-400/50 hover:bg-white/10 hover:text-white"
  );
}
