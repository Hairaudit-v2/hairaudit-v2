"use client";

import CreateCaseButton from "@/app/dashboard/create-case-button";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";

type PatientNewCasePathwayButtonsProps = {
  variant?: "default" | "premium" | "card";
  className?: string;
  layout?: "inline" | "stack";
};

export default function PatientNewCasePathwayButtons({
  variant = "premium",
  className,
  layout = "inline",
}: PatientNewCasePathwayButtonsProps) {
  const containerClass =
    layout === "stack"
      ? "flex flex-col gap-3"
      : "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center";

  return (
    <div className={cn(containerClass, className)} data-testid="patient-new-case-pathway-buttons">
      <CreateCaseButton
        variant={variant}
        pathway="pre_surgery"
        label={PUBLIC_CTAS.startPreSurgeryReview}
      />
      <CreateCaseButton
        variant={variant}
        pathway="post_surgery"
        label={PUBLIC_CTAS.startPostSurgeryAudit}
      />
    </div>
  );
}
