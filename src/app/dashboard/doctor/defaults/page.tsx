import { redirect } from "next/navigation";

// Demo defaults editor removed from production. Per-case overrides are applied on /cases/[caseId]/doctor/form (saved defaults in localStorage at form boundary).
export default function DoctorDefaultsPage() {
  redirect("/dashboard/doctor");
}
