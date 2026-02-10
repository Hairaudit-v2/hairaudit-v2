export type UserRole = "patient" | "doctor" | "clinic" | "auditor";

export const USER_ROLES: UserRole[] = ["patient", "doctor", "clinic", "auditor"];

export const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  clinic: "Clinic",
  auditor: "Auditor",
};

export function parseRole(role: unknown): UserRole {
  if (typeof role === "string" && USER_ROLES.includes(role as UserRole)) {
    return role as UserRole;
  }
  return "patient";
}
