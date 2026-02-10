// Doctor form: Pre-Procedure, Surgery, Post-Procedure images

export const DOCTOR_PHOTO_CATEGORIES = [
  { key: "pre_procedure", title: "Pre-Procedure Images", required: false, help: "Before surgery", tips: [], accept: "image/*", maxFiles: 6, minFiles: 0 },
  { key: "surgery", title: "Surgery Images", required: false, help: "During procedure", tips: [], accept: "image/*", maxFiles: 10, minFiles: 0 },
  { key: "post_procedure", title: "Post-Procedure Images", required: false, help: "After surgery", tips: [], accept: "image/*", maxFiles: 6, minFiles: 0 },
] as const;

export type DoctorPhotoCategory = (typeof DOCTOR_PHOTO_CATEGORIES)[number]["key"];
