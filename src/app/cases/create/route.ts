/**
 * Legacy path `POST /cases/create` — thin wrapper around the same handler as `POST /api/cases/create`.
 * Prefer `/api/cases/create` for new clients.
 */
import { handlePostCreateAuditCaseRoute } from "@/lib/cases/createAuditCasePostHandler.server";

export async function POST(req: Request) {
  return handlePostCreateAuditCaseRoute(req);
}
