import PathwayChooserRedirect from "@/components/patient/PathwayChooserRedirect";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

export const metadata = createPageMetadata({
  title: "Request HairAudit Review",
  description: "Choose your independent hair transplant review pathway.",
  pathname: "/patient/review",
});

/** Legacy patient review entry — forwards to the public pathway chooser. */
export default function PatientReviewRedirectPage() {
  return <PathwayChooserRedirect />;
}
