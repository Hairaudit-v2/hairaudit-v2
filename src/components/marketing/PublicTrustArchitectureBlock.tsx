import {
  PUBLIC_INDEPENDENCE_MESSAGE,
  PUBLIC_TRUST_PLATFORM_MESSAGE,
} from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";

type PublicTrustArchitectureBlockProps = {
  className?: string;
  surface?: "fi" | "dark";
};

export default function PublicTrustArchitectureBlock({
  className,
  surface = "dark",
}: PublicTrustArchitectureBlockProps) {
  const isFi = surface === "fi";

  return (
    <section
      className={cn(
        "rounded-2xl border p-6 sm:p-7",
        isFi
          ? "border-emerald-400/25 bg-emerald-400/5"
          : "border-emerald-400/20 bg-emerald-400/5",
        className
      )}
      aria-label="HairAudit trust and independence"
    >
      <p
        className={cn(
          "text-sm leading-relaxed",
          isFi ? "text-foreground/90" : "text-emerald-50/95"
        )}
      >
        {PUBLIC_TRUST_PLATFORM_MESSAGE}
      </p>
      <p
        className={cn(
          "mt-3 text-sm font-semibold",
          isFi ? "text-emerald-300" : "text-emerald-200"
        )}
      >
        {PUBLIC_INDEPENDENCE_MESSAGE}
      </p>
    </section>
  );
}
