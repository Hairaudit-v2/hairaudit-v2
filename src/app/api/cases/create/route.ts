import { handlePostCreateAuditCaseRoute } from "@/lib/cases/createAuditCasePostHandler.server";

export async function POST(req: Request) {
  return handlePostCreateAuditCaseRoute(req);
}
