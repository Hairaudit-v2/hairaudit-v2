import { createHmac, timingSafeEqual } from "crypto";
import { normalizeAuditMode, type AuditMode } from "@/lib/pdf/reportBuilder";

type RenderTokenPayload = {
  caseId: string;
  auditMode: AuditMode;
  exp: number;
};

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signRenderToken(args: {
  caseId: string;
  auditMode?: string;
  exp: number;
  secret: string;
}): string {
  const payload: RenderTokenPayload = {
    caseId: args.caseId,
    auditMode: normalizeAuditMode(args.auditMode),
    exp: Number(args.exp),
  };
  const body = toBase64Url(JSON.stringify(payload));
  const sig = createHmac("sha256", args.secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyRenderToken(token: string, secret: string): RenderTokenPayload | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, sigBuf)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(body)) as Partial<RenderTokenPayload>;
    const caseId = String(parsed.caseId ?? "");
    const auditMode = normalizeAuditMode(parsed.auditMode);
    const exp = Number(parsed.exp ?? 0);
    if (!caseId || !Number.isFinite(exp)) return null;
    if (Date.now() >= exp) return null;
    return { caseId, auditMode, exp };
  } catch {
    return null;
  }
}
