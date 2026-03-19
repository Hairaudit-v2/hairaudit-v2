import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Sign Up | HairAudit",
  description:
    "Create your HairAudit account as a patient, clinic, or doctor. Create a free clinic or doctor profile, or submit cases for independent review as a patient.",
  pathname: "/signup",
  noindex: true,
});

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
