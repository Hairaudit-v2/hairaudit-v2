import { createPageMetadata } from "@/lib/seo/pageMetadata";
import HowItWorksMarketing from "@/components/marketing/HowItWorksMarketing";

export const metadata = createPageMetadata({
  title: "How It Works | HairAudit",
  description:
    "See how HairAudit reviews surgery photos with structured analysis, expert review, and clear reporting.",
  pathname: "/how-it-works",
});

export default function HowItWorksPage() {
  return <HowItWorksMarketing />;
}
