// Clinic form: Facilities, Equipment, Procedure

export const CLINIC_PHOTO_CATEGORIES = [
  { key: "facilities", title: "Clinic Facilities Images", required: false, help: "Operating rooms, recovery areas", tips: [], accept: "image/*", maxFiles: 10, minFiles: 0 },
  { key: "equipment", title: "Equipment Images", required: false, help: "Hair transplant equipment", tips: [], accept: "image/*", maxFiles: 6, minFiles: 0 },
  { key: "procedure", title: "Procedure Images/Videos", required: false, help: "Sample procedure documentation", tips: [], accept: "image/*,video/*", maxFiles: 6, minFiles: 0 },
] as const;

export type ClinicPhotoCategory = (typeof CLINIC_PHOTO_CATEGORIES)[number]["key"];
