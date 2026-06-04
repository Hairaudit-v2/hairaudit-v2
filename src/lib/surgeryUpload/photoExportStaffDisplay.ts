// Stage 8C — pure staff/uploader display labels (no DB; safe for evidenceEvents client bundle).

type ProfileLite = { display_name?: string | null; role?: string | null };

/**
 * Human-facing label for a profile: display_name when set, otherwise a generic role label.
 * Never returns raw UUIDs.
 */
export function staffDisplayLabelFromProfile(profile: ProfileLite | undefined): string {
  const name = profile?.display_name?.trim();
  if (name) return name.slice(0, 120);
  switch (profile?.role) {
    case "auditor":
      return "Reviewer";
    case "clinic":
      return "Clinic user";
    case "doctor":
      return "Doctor";
    case "patient":
      return "User";
    default:
      return "User";
  }
}
