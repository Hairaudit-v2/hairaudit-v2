import { redirect } from "next/navigation";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/sample-report",
  },
};

export default function SampleAuditAliasPage() {
  redirect("/sample-report");
}
