import PathwayChooserRedirect from "@/components/patient/PathwayChooserRedirect";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Start Free HairAudit Review",
  description: "Choose pre-surgery or post-surgery review pathway.",
  pathname: "/free-audit",
});

/** Legacy marketing URL — forwards to the pathway chooser. */
export default function FreeAuditRedirectPage() {
  return <PathwayChooserRedirect />;
}
