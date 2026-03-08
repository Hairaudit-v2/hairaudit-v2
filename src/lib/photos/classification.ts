type UploadLike = {
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

function tokenize(upload: UploadLike): string {
  const type = String(upload.type ?? "").toLowerCase();
  const path = String(upload.storage_path ?? "").toLowerCase();
  const meta = upload.metadata ?? {};
  const category = String(meta.category ?? "").toLowerCase();
  const label = String(meta.label ?? "").toLowerCase();
  const originalName = String(meta.original_name ?? "").toLowerCase();
  return [type, path, category, label, originalName].join(" ");
}

function hasAny(s: string, needles: string[]) {
  return needles.some((n) => s.includes(n));
}

export function inferCanonicalPhotoCategory(upload: UploadLike): string {
  const s = tokenize(upload);

  if (hasAny(s, ["donor", "occipital", "rear donor", "donor_rear"])) {
    if (hasAny(s, ["day0", "day-0", "intraop", "intra-op", "surgery day", "any_day0"])) {
      return "day0_donor";
    }
    if (hasAny(s, ["postop", "post-op", "healed", "month", "m1_", "m3_", "m6_"])) {
      return "postop_healed_donor";
    }
    return "preop_donor_rear";
  }

  if (hasAny(s, ["intraop", "intra-op"])) return "intraop";
  if (hasAny(s, ["day0", "day-0", "any_day0"])) return "day0_recipient";
  if (hasAny(s, ["postop", "post-op", "any_early_postop", "day7", "m1_", "m3_", "m6_"])) {
    return "postop_healed";
  }

  if (hasAny(s, ["current_front", "patient_current_front"])) return "current_front";
  if (hasAny(s, ["current_top", "patient_current_top"])) return "current_top";
  if (hasAny(s, ["patient_current_donor_rear"])) return "current_donor_rear";
  if (hasAny(s, ["patient_current_left"])) return "current_left";
  if (hasAny(s, ["patient_current_right"])) return "current_right";
  if (hasAny(s, ["patient_current_crown"])) return "current_crown";

  if (hasAny(s, ["preop_front", "front"])) return "preop_front";
  if (hasAny(s, ["preop_left", "left"])) return "preop_left";
  if (hasAny(s, ["preop_right", "right"])) return "preop_right";
  if (hasAny(s, ["preop_top", "top"])) return "preop_top";
  if (hasAny(s, ["preop_crown", "crown", "vertex"])) return "preop_crown";
  if (hasAny(s, ["any_preop", "pre-op", "preop"])) return "preop_misc";

  return "uncategorized";
}

export function photoCategoryGroup(category: string): string {
  const c = String(category);
  if (c.startsWith("preop_")) return "Pre-op";
  if (c.startsWith("current_")) return "Current";
  if (c === "day0_donor") return "Day-of Donor";
  if (c === "day0_recipient") return "Day-of Recipient";
  if (c === "intraop") return "Intra-op";
  if (c.startsWith("postop_")) return "Post-op";
  return "Other";
}

export function scorePhotoForAudit(upload: UploadLike): number {
  const c = inferCanonicalPhotoCategory(upload);
  switch (c) {
    case "day0_donor":
    case "day0_recipient":
      return 100;
    case "preop_donor_rear":
    case "preop_front":
    case "preop_top":
    case "preop_crown":
      return 90;
    case "preop_left":
    case "preop_right":
      return 80;
    case "intraop":
      return 70;
    case "postop_healed":
    case "postop_healed_donor":
      return 65;
    case "current_front":
    case "current_top":
    case "current_donor_rear":
    case "current_left":
    case "current_right":
    case "current_crown":
      return 60;
    case "preop_misc":
      return 55;
    default:
      return 30;
  }
}

export function buildAuditImageSelection<T extends UploadLike>(uploads: T[], max = 10): T[] {
  if (uploads.length <= max) return uploads;

  const byCategory = new Map<string, T[]>();
  for (const upload of uploads) {
    const cat = inferCanonicalPhotoCategory(upload);
    const arr = byCategory.get(cat) ?? [];
    arr.push(upload);
    byCategory.set(cat, arr);
  }

  const picks: T[] = [];
  const categoryPriority = [
    "day0_donor",
    "day0_recipient",
    "preop_donor_rear",
    "preop_front",
    "preop_top",
    "preop_crown",
    "preop_left",
    "preop_right",
    "intraop",
    "postop_healed",
  ];

  for (const cat of categoryPriority) {
    const first = byCategory.get(cat)?.[0];
    if (first) picks.push(first);
    if (picks.length >= max) return picks;
  }

  const remaining = [...uploads]
    .filter((u) => !picks.includes(u))
    .sort((a, b) => scorePhotoForAudit(b) - scorePhotoForAudit(a));
  for (const upload of remaining) {
    picks.push(upload);
    if (picks.length >= max) break;
  }
  return picks;
}
