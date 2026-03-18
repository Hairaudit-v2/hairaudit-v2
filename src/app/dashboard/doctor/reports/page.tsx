import DoctorComingSoon from "../DoctorComingSoon";

export default function DoctorReportsPage() {
  return (
    <DoctorComingSoon
      title="Audit reports hub"
      description="A single place to see all your audit reports and pending actions is coming soon. For now, open any case from your overview to view its report and resolve feedback."
      alternative={{ label: "Go to overview", href: "/dashboard/doctor" }}
    />
  );
}
