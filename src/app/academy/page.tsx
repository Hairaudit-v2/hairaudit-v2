import { redirect } from "next/navigation";
import { getAcademyAccess } from "@/lib/academy/auth";

export const dynamic = "force-dynamic";

export default async function AcademyIndexPage() {
  const access = await getAcademyAccess();
  if (!access.ok) {
    if (access.reason === "no_session") redirect("/academy/login");
    if (access.reason === "beta_blocked") redirect("/beta-access-message");
    redirect("/academy/no-access");
  }
  redirect("/academy/dashboard");
}
