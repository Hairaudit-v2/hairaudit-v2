/**
 * HA-PATIENT-REPORT-UI-1A — Group clinical uploads into patient-safe photo roles.
 */

import {
  resolvePatientFriendlyPhotoLabel,
} from "@/lib/reports/clinicalEvidenceGallery";
import { inferCanonicalPhotoCategory } from "@/lib/photos/classification";
import type {
  PatientReportPhoto,
  PatientReportPhotoGroup,
  PatientReportPhotoGroupId,
  PatientReportPhotoRole,
} from "@/lib/patientReport/types";

type UploadLike = {
  id?: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

const GROUP_TITLES: Record<PatientReportPhotoGroupId, string> = {
  rear_donor: "Rear donor",
  left_donor: "Left donor",
  right_donor: "Right donor",
  additional_evidence: "Additional evidence",
};

function stripPhotoPrefix(type: string): string {
  const t = type.toLowerCase();
  return t.startsWith("patient_photo:") ? t.slice("patient_photo:".length) : t;
}

function classifyRole(canonical: string): {
  role: PatientReportPhotoRole;
  groupId: PatientReportPhotoGroupId;
} {
  const c = canonical.toLowerCase();
  if (c.includes("donor") && c.includes("left")) {
    return { role: "donor_left", groupId: "left_donor" };
  }
  if (c.includes("donor") && c.includes("right")) {
    return { role: "donor_right", groupId: "right_donor" };
  }
  if (
    c.includes("donor") &&
    (c.includes("rear") || c.includes("back") || c.includes("healed_donor") || c === "followup_donor")
  ) {
    return { role: "donor_rear", groupId: "rear_donor" };
  }
  if (c.includes("close") || c.includes("macro")) {
    return { role: "close_up", groupId: "additional_evidence" };
  }
  if (c.includes("preop") || c.includes("pre_surgery") || c.includes("baseline")) {
    return { role: "pre_surgery", groupId: "additional_evidence" };
  }
  if (c.includes("day0") || c.includes("surgery") || c.includes("intraop")) {
    return { role: "surgery_day", groupId: "additional_evidence" };
  }
  if (c.includes("followup") || c.includes("follow_up") || c.includes("postop")) {
    return { role: "follow_up", groupId: "additional_evidence" };
  }
  if (c.includes("recipient") || c.includes("hairline") || c.includes("crown") || c.includes("front")) {
    return { role: "recipient", groupId: "additional_evidence" };
  }
  if (c.includes("donor")) {
    return { role: "donor_rear", groupId: "rear_donor" };
  }
  return { role: "additional", groupId: "additional_evidence" };
}

function evidenceQualityFromMeta(
  metadata?: Record<string, unknown> | null
): string | undefined {
  if (!metadata) return undefined;
  const raw =
    metadata.evidence_quality ??
    metadata.evidenceQuality ??
    metadata.quality_label ??
    metadata.qualityLabel;
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.trim();
  if (!cleaned) return undefined;
  // Only allow short patient-safe tokens.
  if (/^[a-zA-Z0-9 _-]{2,40}$/.test(cleaned)) {
    return cleaned.replaceAll("_", " ");
  }
  return undefined;
}

function dateFromMeta(metadata?: Record<string, unknown> | null): string | undefined {
  if (!metadata) return undefined;
  const raw = metadata.captured_at ?? metadata.capturedAt ?? metadata.photo_date ?? metadata.photoDate;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function groupUploadsIntoPatientReportPhotos(
  uploads: UploadLike[]
): PatientReportPhotoGroup[] {
  const buckets: Record<PatientReportPhotoGroupId, PatientReportPhoto[]> = {
    rear_donor: [],
    left_donor: [],
    right_donor: [],
    additional_evidence: [],
  };

  for (const upload of uploads) {
    const type = String(upload.type ?? "");
    if (!type) continue;
    const lower = type.toLowerCase();
    const looksLikePhoto =
      lower.startsWith("patient_photo:") ||
      lower.includes("photo") ||
      lower.includes("image") ||
      lower.includes("jpg") ||
      lower.includes("png") ||
      lower.includes("webp");
    if (!looksLikePhoto) continue;

    const stripped = stripPhotoPrefix(type);
    const canonical =
      inferCanonicalPhotoCategory({ type, metadata: upload.metadata }) || stripped;
    const { role, groupId } = classifyRole(canonical);
    const label = resolvePatientFriendlyPhotoLabel({
      canonicalCategory: canonical,
      upload,
    });
    const fetchKey = typeof upload.id === "string" && upload.id ? upload.id : undefined;

    buckets[groupId].push({
      role,
      label,
      alt: label,
      dateLabel: dateFromMeta(upload.metadata),
      evidenceQualityLabel: evidenceQualityFromMeta(upload.metadata),
      groupId,
      fetchKey,
      imageUrl: null,
    });
  }

  const order: PatientReportPhotoGroupId[] = [
    "rear_donor",
    "left_donor",
    "right_donor",
    "additional_evidence",
  ];

  return order
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({
      id,
      title: GROUP_TITLES[id],
      photos: buckets[id],
    }));
}
