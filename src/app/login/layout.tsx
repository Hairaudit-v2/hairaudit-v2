export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in | HairAudit",
  description:
    "Sign in to your HairAudit patient beta account to request an audit or track your case. HairAudit is currently in a controlled patient beta phase.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
