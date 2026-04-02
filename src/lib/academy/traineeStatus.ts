/** Values allowed in training_doctors.status (DB CHECK must stay in sync). */
export const TRAINEE_STATUSES = ["active", "paused", "graduated", "withdrawn", "archived"] as const;
export type TraineeStatus = (typeof TRAINEE_STATUSES)[number];

/** Shown on default staff trainee lists (excludes withdrawn/archived). */
export const OPERATIONAL_TRAINEE_STATUSES: TraineeStatus[] = ["active", "paused", "graduated"];

const STATUS_SET = new Set<string>(TRAINEE_STATUSES);

export function isAllowedTraineeStatus(s: string): s is TraineeStatus {
  return STATUS_SET.has(s);
}

export function isOperationalTraineeStatus(s: string): boolean {
  return (OPERATIONAL_TRAINEE_STATUSES as readonly string[]).includes(s);
}

export function traineeStatusLabel(s: string): string {
  switch (s) {
    case "archived":
      return "Archived";
    case "withdrawn":
      return "Withdrawn";
    case "graduated":
      return "Graduated";
    case "paused":
      return "Paused";
    case "active":
      return "Active";
    default:
      return s;
  }
}

/** URL / API filter: operational | active | paused | graduated | withdrawn | archived | all */
export type TraineeListStatusFilter =
  | "operational"
  | TraineeStatus
  | "all";

export function parseTraineeListStatusFilter(raw: string | null | undefined): TraineeListStatusFilter {
  const v = (raw ?? "operational").trim().toLowerCase();
  if (v === "all" || v === "operational") return v;
  if (isAllowedTraineeStatus(v)) return v;
  return "operational";
}

export function statusesForListFilter(filter: TraineeListStatusFilter): TraineeStatus[] | "all" {
  if (filter === "all") return "all";
  if (filter === "operational") return [...OPERATIONAL_TRAINEE_STATUSES];
  return [filter];
}
