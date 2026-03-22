import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";
import { getQpdfReadiness } from "@/lib/pdf/qpdfReadiness";

const execFileAsync = promisify(execFile);

export type PostProcessPdfResult = {
  buffer: Buffer;
  /** True when qpdf --linearize ran successfully. */
  linearized: boolean;
};

/**
 * Optional fast-web-view linearization via qpdf when enabled and the binary exists.
 * Safe no-op on serverless or missing qpdf. Uses cached {@link getQpdfReadiness} (one probe per process).
 */
export async function maybePostProcessAuditPdf(buffer: Buffer): Promise<PostProcessPdfResult> {
  if (!pdfEnvConfig.isLinearizationEnabled()) {
    return { buffer, linearized: false };
  }

  const readiness = await getQpdfReadiness();
  if (!readiness.available) {
    return { buffer, linearized: false };
  }

  const cmd = readiness.command;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hairaudit-pdf-"));
  const inPath = path.join(tmp, "in.pdf");
  const outPath = path.join(tmp, "out.pdf");

  try {
    await fs.writeFile(inPath, buffer);
    await execFileAsync(cmd, ["--linearize", inPath, outPath], {
      timeout: 180_000,
      maxBuffer: 120 * 1024 * 1024,
      windowsHide: true,
    });
    const out = await fs.readFile(outPath);
    if (out.length === 0) {
      console.warn("[pdf-linearize] qpdf produced empty output; using original");
      return { buffer, linearized: false };
    }
    console.info("[pdf-linearize] linearization applied", {
      inBytes: buffer.length,
      outBytes: out.length,
    });
    return { buffer: out, linearized: true };
  } catch (e) {
    console.warn("[pdf-linearize] qpdf failed; using original pdf", {
      message: (e as Error)?.message ?? String(e),
    });
    return { buffer, linearized: false };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
