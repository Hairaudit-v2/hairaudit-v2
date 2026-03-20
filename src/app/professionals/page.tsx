import ProfessionalsHub from "@/components/marketing/ProfessionalsHub";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "For Professionals | HairAudit",
  description:
    "Review HairAudit standards for methodology, scoring, evidence quality, participation, and documentation frameworks.",
  pathname: "/professionals",
});

export default function ProfessionalsPage() {
  return <ProfessionalsHub />;
}
