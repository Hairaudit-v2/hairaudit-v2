/**
 * FI-OUTCOME-INTELLIGENCE-1F — Longitudinal review (1G print HTML) page object.
 */

import type { Page } from "playwright/test";
import { expect } from "playwright/test";
import { signRenderToken } from "../../../../src/lib/reports/internalRenderToken";
import { requireReportRenderTokenSecret } from "../../../../src/lib/security/secrets";
import { resolveE2eBaseUrl } from "../env";

const UNSAFE_PATTERNS = [
  /successful transplant/i,
  /failed transplant/i,
  /better than expected/i,
  /worse than expected/i,
  /growth\s*%/i,
  /survival\s*%/i,
  /accuracy\s*%/i,
];

export class LongitudinalReviewPage {
  constructor(private readonly page: Page) {}

  buildReviewUrl(args: {
    caseId: string;
    projectionSnapshotId: string;
    observationSnapshotId: string;
    comparisonSnapshotId: string;
  }): string | null {
    try {
      const secret = requireReportRenderTokenSecret();
      const token = signRenderToken({
        caseId: args.caseId,
        auditMode: "patient",
        exp: Date.now() + 15 * 60 * 1000,
        secret,
      });
      const url = new URL("/api/print/report", resolveE2eBaseUrl());
      url.searchParams.set("caseId", args.caseId);
      url.searchParams.set("auditMode", "patient");
      url.searchParams.set("token", token);
      url.searchParams.set("assessmentType", "longitudinal_projection_review");
      url.searchParams.set("projectionSnapshotId", args.projectionSnapshotId);
      url.searchParams.set("observationSnapshotId", args.observationSnapshotId);
      url.searchParams.set("comparisonSnapshotId", args.comparisonSnapshotId);
      return url.toString();
    } catch {
      return null;
    }
  }

  async open(args: {
    caseId: string;
    projectionSnapshotId: string;
    observationSnapshotId: string;
    comparisonSnapshotId: string;
  }): Promise<void> {
    const url = this.buildReviewUrl(args);
    expect(url, "REPORT_RENDER_TOKEN required for 1G review route").toBeTruthy();
    const res = await this.page.goto(url!, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 500).toBeLessThan(400);
  }

  async expectSafeReviewContent(): Promise<void> {
    const body = await this.page.locator("body").innerText();
    expect(body).toMatch(/Projected/i);
    expect(body).toMatch(/Observed/i);
    expect(body).toMatch(/Comparison/i);
    for (const pat of UNSAFE_PATTERNS) {
      expect(body, `unsafe pattern ${pat}`).not.toMatch(pat);
    }
  }
}
