export const metadata = {
  title: "Beta Access Notice | HairAudit",
  description:
    "HairAudit beta currently supports patient, doctor, and clinic experiences. This page appears when an account role is not enabled for beta access.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BetaAccessMessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
