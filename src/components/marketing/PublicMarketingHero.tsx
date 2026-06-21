import type { ReactNode } from "react";

import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import { cn } from "@/lib/utils";
import { Badge, Section } from "@/packages/ui";

type PublicMarketingHeroProps = {
  badge: string;
  title: string;
  description: ReactNode;
  showTrustBlock?: boolean;
  centered?: boolean;
  children?: ReactNode;
  className?: string;
};

export default function PublicMarketingHero({
  badge,
  title,
  description,
  showTrustBlock = true,
  centered = false,
  children,
  className,
}: PublicMarketingHeroProps) {
  return (
    <Section className={cn("pt-10 sm:pt-14", className)}>
      <div
        className={cn(
          "mx-auto max-w-4xl space-y-6",
          centered && "text-center [&_p]:mx-auto"
        )}
      >
        <Badge tone="accent">{badge}</Badge>
        <div className={cn("space-y-4", centered && "mx-auto")}>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <div className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </div>
        </div>
        {showTrustBlock ? <PublicTrustArchitectureBlock surface="fi" /> : null}
        {children}
      </div>
    </Section>
  );
}
