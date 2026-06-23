"use client";

import { useEffect } from "react";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";

/** Client redirect so hash fragments (e.g. #choose-pathway) are preserved. */
export default function PathwayChooserRedirect() {
  useEffect(() => {
    window.location.replace(PATHWAY_CHOOSER_HREF);
  }, []);

  return (
    <p className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">
      Redirecting to review type selection…
    </p>
  );
}
