export const metadata = {
  title: "Patient Beta Access | HairAudit",
  description:
    "HairAudit is currently operating in a controlled patient beta phase. During beta, individuals can submit transplant cases for independent forensic review. Clinic and doctor access will open in later stages.",
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
