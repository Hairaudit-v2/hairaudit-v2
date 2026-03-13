import PortalPlaceholderPanel from "@/components/clinic-portal/PortalPlaceholderPanel";

export default function ClinicCasesPlaceholderPage() {
  return (
    <PortalPlaceholderPanel
      title="Clinic Cases"
      subtitle="Case-level operating board for clinic-owned audit pipelines."
      recommendation="This module will centralize all clinic case operations, filtering, and lifecycle controls. In the meantime, use Workspaces for active case response and visibility management."
    />
  );
}
