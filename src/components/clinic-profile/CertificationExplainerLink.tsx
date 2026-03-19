import Link from "next/link";

/**
 * Subtle "What does this mean?" link near certification badge.
 * Points to /certification-explained.
 */
type CertificationExplainerLinkProps = {
  className?: string;
};

export default function CertificationExplainerLink({ className = "" }: CertificationExplainerLinkProps) {
  return (
    <Link
      href="/certification-explained"
      className={`text-xs text-slate-500 hover:text-slate-400 transition-colors ${className}`}
    >
      What does this mean?
    </Link>
  );
}
