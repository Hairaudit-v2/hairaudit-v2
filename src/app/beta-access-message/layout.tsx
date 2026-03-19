import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Beta Access Notice | HairAudit",
  description:
    "HairAudit beta currently supports patient, doctor, and clinic experiences. This page appears when an account role is not enabled for beta access.",
  pathname: "/beta-access-message",
  noindex: true,
});

export default function BetaAccessMessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
