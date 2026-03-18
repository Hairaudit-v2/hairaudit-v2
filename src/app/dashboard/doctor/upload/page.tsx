import DoctorComingSoon from "../DoctorComingSoon";

export default function DoctorUploadPage() {
  return (
    <DoctorComingSoon
      title="Bulk upload"
      description="A dedicated upload wizard for adding multiple cases in one flow is planned. For now, create cases from your overview and complete the form and photos for each case."
      alternative={{ label: "Create a case", href: "/dashboard/doctor" }}
    />
  );
}
