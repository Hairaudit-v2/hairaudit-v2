import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Sign in | HairAudit",
  description:
    "Sign in to your HairAudit beta account to request an audit or manage your cases. Patient, doctor, and clinic experiences are currently in beta testing.",
  pathname: "/login",
  noindex: true,
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
