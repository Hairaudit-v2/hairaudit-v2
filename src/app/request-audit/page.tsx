import { redirect } from "next/navigation";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/request-review",
  },
};

export default function RequestAuditAliasPage() {
  redirect("/request-review");
}
