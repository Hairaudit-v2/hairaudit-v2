"use client";

import { useRouter } from "next/navigation";
import AcademyQuickUpload from "@/components/academy/AcademyQuickUpload";

export default function AcademyCaseUploadBar({ caseId }: { caseId: string }) {
  const router = useRouter();
  return <AcademyQuickUpload caseId={caseId} onUploaded={() => router.refresh()} />;
}
