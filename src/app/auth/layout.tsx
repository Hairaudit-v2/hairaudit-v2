/**
 * Auth routes (recovery, magic-link) are not for indexing.
 * No canonical so we don't override child paths; layout sets shared noindex only.
 */
export const metadata = {
  title: "Auth | HairAudit",
  description: "Password recovery or magic link verification.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
