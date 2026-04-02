import type { AcademyUserRole } from "./constants";

/** UI labels for academy roles (clinic_staff shown as coordinator / nurse-friendly copy). */
export function academyRoleDisplayLabel(role: AcademyUserRole): string {
  switch (role) {
    case "academy_admin":
      return "Academy admin";
    case "trainer":
      return "Trainer";
    case "clinic_staff":
      return "Clinic coordinator / nurse";
    case "trainee":
      return "Trainee";
    default:
      return role;
  }
}

export const ACADEMY_ROLE_OPTIONS: { value: AcademyUserRole; label: string }[] = [
  { value: "academy_admin", label: "Academy admin" },
  { value: "trainer", label: "Trainer (surgeon / faculty)" },
  { value: "clinic_staff", label: "Clinic coordinator / nurse" },
  { value: "trainee", label: "Trainee" },
];
