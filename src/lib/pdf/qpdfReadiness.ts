import { execFile } from "child_process";
import { promisify } from "util";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";

const execFileAsync = promisify(execFile);

export type QpdfReadiness = {
  available: boolean;
  version: string | null;
  command: string;
};

let inFlight: Promise<QpdfReadiness> | null = null;
let readinessLogged = false;

async function probeOnce(): Promise<QpdfReadiness> {
  const command = pdfEnvConfig.getQpdfPath();
  try {
    const { stdout } = await execFileAsync(command, ["--version"], {
      timeout: 8000,
      windowsHide: true,
    });
    const text = String(stdout ?? "").trim();
    const version = text ? text.split(/\r?\n/)[0]!.trim() : null;
    return { available: true, version, command };
  } catch {
    return { available: false, version: null, command };
  }
}

/**
 * Cached qpdf probe for the lifetime of the process (warm serverless invocations reuse it).
 * Logs once at info: `[pdf-qpdf-readiness]` with availability and version.
 */
export function getQpdfReadiness(): Promise<QpdfReadiness> {
  if (!inFlight) {
    inFlight = (async () => {
      const result = await probeOnce();
      if (!readinessLogged) {
        readinessLogged = true;
        console.info("[pdf-qpdf-readiness]", {
          available: result.available,
          version: result.version,
          command: result.command,
        });
      }
      return result;
    })();
  }
  return inFlight;
}
