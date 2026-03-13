import ClinicSidebarNav, { type ClinicNavItem } from "./ClinicSidebarNav";
import ClinicTopbar from "./ClinicTopbar";

export default function ClinicPortalShell({
  clinicName,
  trustStatus,
  avatarLabel,
  pendingResponses,
  completionPercent,
  onboardingSteps,
  statusChips,
  nextAction,
  navItems,
  children,
}: {
  clinicName: string;
  trustStatus: string;
  avatarLabel: string;
  pendingResponses: number;
  completionPercent: number;
  onboardingSteps: number;
  statusChips: Array<{ label: string; ready: boolean }>;
  nextAction: {
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
  };
  navItems: ClinicNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6">
          <ClinicTopbar
            clinicName={clinicName}
            trustStatus={trustStatus}
            avatarLabel={avatarLabel}
            pendingResponses={pendingResponses}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ClinicSidebarNav
            clinicName={clinicName}
            navItems={navItems}
            trustStatus={trustStatus}
            completionPercent={completionPercent}
            onboardingSteps={onboardingSteps}
            statusChips={statusChips}
            nextAction={nextAction}
          />

          <main className="min-w-0">
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
