import type { ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Kept for call-site compatibility; no longer used (scroll-driven motion removed for web-vitals). */
  delay?: number;
  once?: boolean;
};

/**
 * Static layout wrapper (formerly Framer Motion scroll reveal).
 * Avoids shipping ~framer-motion~ and scroll observers on marketing / guide routes.
 */
export default function ScrollReveal({ children, className }: ScrollRevealProps) {
  return <div className={className}>{children}</div>;
}
