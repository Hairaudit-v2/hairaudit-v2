import { redirect } from "next/navigation";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/verified-surgeon-program",
  },
};

export default function VerifiedProgramAliasPage() {
  redirect("/verified-surgeon-program");
}
