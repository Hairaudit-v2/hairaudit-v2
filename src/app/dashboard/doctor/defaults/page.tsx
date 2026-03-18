import DoctorComingSoon from "../DoctorComingSoon";

export default function DoctorDefaultsPage() {
  return (
    <DoctorComingSoon
      title="Surgical defaults"
      description="Saving default answers (e.g. extraction method, holding solution) to reuse across cases is planned. For now, set values per case on each case’s doctor form."
      alternative={{ label: "Go to overview", href: "/dashboard/doctor" }}
    />
  );
}
