/**
 * Repository-safe GII backfill for historical cases (guarded internal auth).
 *
 * Modes (set ALLOW_GII_BACKFILL=true in all cases):
 *
 * 1) Workflow (recommended for batches): GII_BACKFILL_USE_WORKFLOW=true
 *    → POST /api/internal/gii-historical-backfill once; Inngest runs `internal/gii-historical-backfill`
 *    (sequential GII reruns, 500ms spacing inside the workflow).
 *
 * 2) Direct: default — POST /api/auditor/rerun per case (500ms between requests).
 *
 * Script env:
 *   ALLOW_GII_BACKFILL=true
 *   GII_BACKFILL_IDS=<comma-separated case UUIDs>
 *   INTERNAL_BACKFILL_KEY=<shared secret; must match server>
 *   BACKFILL_BASE_URL=<app origin, default http://localhost:3000>
 *   GII_BACKFILL_USE_WORKFLOW=true   (optional)
 *
 * Server env for internal requests:
 *   ALLOW_GII_BACKFILL=true, INTERNAL_BACKFILL_KEY, GII_BACKFILL_TRIGGERED_BY
 *
 *   pnpm run backfill:gii
 */

const DELAY_MS = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function envFlagTrue(v: string | undefined): boolean {
  return String(v ?? "").trim().toLowerCase() === "true";
}

function parseCaseIds(raw: string | undefined): string[] {
  const ids = String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = ids.filter((id) => !UUID_RE.test(id));
  if (bad.length > 0) {
    throw new Error(`Invalid UUID(s) in GII_BACKFILL_IDS: ${bad.join(", ")}`);
  }
  return ids;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LogLine = {
  case_id: string;
  success: boolean;
  status: number;
  error?: string;
  rerun_log_id?: string;
};

async function postRerun(baseUrl: string, internalKey: string, caseId: string): Promise<LogLine> {
  const url = new URL("/api/auditor/rerun", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  let status = 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({
        caseId,
        action: "regenerate_graft_integrity",
        reason: "auditor_review_request",
        notes: "GII historical backfill (scripts/backfill-graft-integrity-cases.ts)",
      }),
    });
    status = res.status;
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      body = { parse_error: true, raw: text.slice(0, 500) };
    }
    const ok = res.ok && body.ok === true;
    return {
      case_id: caseId,
      success: ok,
      status,
      error: typeof body.error === "string" ? body.error : undefined,
      rerun_log_id: typeof body.rerunLogId === "string" ? body.rerunLogId : undefined,
    };
  } catch (e) {
    return {
      case_id: caseId,
      success: false,
      status,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function postWorkflow(baseUrl: string, internalKey: string, caseIds: string[]): Promise<void> {
  const url = new URL("/api/internal/gii-historical-backfill", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": internalKey,
    },
    body: JSON.stringify({ caseIds }),
  });
  const status = res.status;
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  const ok = res.ok && body.ok === true;
  console.log(
    JSON.stringify({
      event: "gii_backfill_workflow_enqueue",
      success: ok,
      status,
      enqueued: typeof body.enqueued === "number" ? body.enqueued : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
      event_name: body.event,
    })
  );
  if (!ok) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  if (!envFlagTrue(process.env.ALLOW_GII_BACKFILL)) {
    console.error("Refusing to run: set ALLOW_GII_BACKFILL=true to enable this script.");
    process.exit(1);
  }

  const internalKey = String(process.env.INTERNAL_BACKFILL_KEY ?? "").trim();
  if (!internalKey) {
    console.error("Missing INTERNAL_BACKFILL_KEY.");
    process.exit(1);
  }

  let caseIds: string[];
  try {
    caseIds = parseCaseIds(process.env.GII_BACKFILL_IDS);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  if (caseIds.length === 0) {
    console.error("GII_BACKFILL_IDS is empty (provide comma-separated case UUIDs).");
    process.exit(1);
  }

  const baseUrl = (process.env.BACKFILL_BASE_URL ?? "http://localhost:3000").trim();
  const useWorkflow = envFlagTrue(process.env.GII_BACKFILL_USE_WORKFLOW);

  console.log(
    JSON.stringify({
      event: "gii_backfill_start",
      case_count: caseIds.length,
      base_url: baseUrl,
      mode: useWorkflow ? "inngest_workflow" : "direct_rerun",
      delay_ms_direct: DELAY_MS,
    })
  );

  if (useWorkflow) {
    await postWorkflow(baseUrl, internalKey, caseIds);
    console.log(JSON.stringify({ event: "gii_backfill_done" }));
    return;
  }

  for (let i = 0; i < caseIds.length; i++) {
    const caseId = caseIds[i];
    const line = await postRerun(baseUrl, internalKey, caseId);
    console.log(JSON.stringify({ event: "gii_backfill_case", ...line }));
    if (i < caseIds.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(JSON.stringify({ event: "gii_backfill_done" }));
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
