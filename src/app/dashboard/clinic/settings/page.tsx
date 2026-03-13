import PortalPlaceholderPanel from "@/components/clinic-portal/PortalPlaceholderPanel";

export default function SettingsPlaceholderPage() {
  return (
    <PortalPlaceholderPanel
      title="Settings"
      subtitle="Portal configuration and default operational controls."
      recommendation="Settings will support role permissions, default visibility behavior, and white-label mode controls. You can already control case-level visibility from Workspaces."
    />
  );
}
