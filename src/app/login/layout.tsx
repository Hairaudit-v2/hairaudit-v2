export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in | HairAudit",
  description:
    "Sign in to your HairAudit beta account to request an audit or manage your workspace. Patient, doctor, and clinic experiences are currently in beta testing.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
