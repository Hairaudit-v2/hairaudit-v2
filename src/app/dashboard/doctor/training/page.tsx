import DoctorComingSoon from "../DoctorComingSoon";

export default function DoctorTrainingPage() {
  return (
    <DoctorComingSoon
      title="Training portal"
      description="Targeted modules to improve documentation and audit readiness are planned. For now, use the audit feedback on each case report to strengthen your submissions."
      alternative={{ label: "Go to overview", href: "/dashboard/doctor" }}
    />
  );
}
