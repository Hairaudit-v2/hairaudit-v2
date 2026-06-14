import { handlePostCreateAuditCaseRoute } from "@/lib/cases/createAuditCasePostHandler.server";

export async function POST() {
  return handlePostCreateAuditCaseRoute();
}
