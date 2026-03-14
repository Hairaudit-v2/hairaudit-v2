import { redirect } from "next/navigation";

// Demo public profile removed from production. Redirect until real profile is wired.
export default function DoctorPublicProfilePage() {
  redirect("/dashboard/doctor");
}
