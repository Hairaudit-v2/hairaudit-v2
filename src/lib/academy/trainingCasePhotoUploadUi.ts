import type { AcademyPhotoCategory } from "./constants";

export type TrainingPhotoGroupId = "preop" | "donor" | "intraop" | "postop" | "extras";

export type TrainingPhotoSlotDef = {
  category: AcademyPhotoCategory;
  title: string;
  caption?: string;
  required: boolean;
};

export type TrainingPhotoGroupDef = {
  id: TrainingPhotoGroupId;
  title: string;
  lead: string;
  slots: TrainingPhotoSlotDef[];
};

/** Visible groups for the training case media workflow — maps to canonical `AcademyPhotoCategory` values. */
export const TRAINING_PHOTO_GROUPS: TrainingPhotoGroupDef[] = [
  {
    id: "preop",
    title: "Pre-operative",
    lead: "Baseline documentation — keep the sequence obvious for audit and teaching.",
    slots: [
      { category: "preop_front", title: "Front", required: true },
      { category: "preop_sides", title: "Sides", caption: "Left & right profiles", required: true },
      { category: "preop_crown", title: "Crown / top", caption: "Vertex & density context", required: false },
    ],
  },
  {
    id: "donor",
    title: "Donor",
    lead: "Donor zone overview and detail.",
    slots: [
      { category: "donor_rear", title: "Donor overview", caption: "Rear / harvest field", required: true },
      { category: "donor_closeup", title: "Donor close-up", caption: "Punch pattern & spacing", required: false },
    ],
  },
  {
    id: "intraop",
    title: "Intra-operative",
    lead: "Operative phases — extraction and placement.",
    slots: [
      { category: "intraop_extraction", title: "Extraction", caption: "Grafts / field during harvest", required: true },
      { category: "intraop_implantation", title: "Implantation", caption: "Recipient sites / placement", required: true },
      { category: "graft_tray", title: "Graft tray", caption: "Handling & staging", required: false },
    ],
  },
  {
    id: "postop",
    title: "Post-operative / result",
    lead: "Immediate post-op and recipient detail.",
    slots: [
      { category: "postop_day0", title: "Post-op day 0", caption: "Immediate result", required: true },
      { category: "recipient_closeup", title: "Recipient close-up", caption: "Hairline / density detail", required: false },
    ],
  },
  {
    id: "extras",
    title: "Planning & extras",
    lead: "Optional context that helps reviewers.",
    slots: [{ category: "hairline_design", title: "Hairline design", caption: "Markup / planning shot", required: false }],
  },
];

export const TRAINING_PHOTO_SLOTS_FLAT: TrainingPhotoSlotDef[] = TRAINING_PHOTO_GROUPS.flatMap((g) => g.slots);
