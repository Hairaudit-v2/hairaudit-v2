"use client";

import AcademyCasePhotosPanel from "@/components/academy/AcademyCasePhotosPanel";
import type { TrainingCaseUploadRow } from "@/lib/academy/types";

export default function AcademyCaseUploadBar({
  caseId,
  initialUploads,
  viewerUserId,
  isStaff,
}: {
  caseId: string;
  initialUploads: TrainingCaseUploadRow[];
  viewerUserId: string;
  isStaff: boolean;
}) {
  return (
    <AcademyCasePhotosPanel
      caseId={caseId}
      initialUploads={initialUploads}
      viewerUserId={viewerUserId}
      isStaff={isStaff}
    />
  );
}
