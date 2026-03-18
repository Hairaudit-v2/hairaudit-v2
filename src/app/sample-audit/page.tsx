import { redirect } from "next/navigation";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/demo-report",
  },
};

export default function SampleAuditAliasPage() {
  redirect("/demo-report");
}
