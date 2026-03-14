import { redirect } from "next/navigation";

// Demo training removed from production. Redirect until real training is wired.
export default function DoctorTrainingPage() {
  redirect("/dashboard/doctor");
}
