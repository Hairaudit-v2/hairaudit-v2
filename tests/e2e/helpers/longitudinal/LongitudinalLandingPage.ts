/**
 * FI-OUTCOME-INTELLIGENCE-1F — Longitudinal landing page object.
 */

import type { Page, Locator } from "playwright/test";
import { expect } from "playwright/test";

export class LongitudinalLandingPage {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("longitudinal-capture-landing");
  }

  timeline(): Locator {
    return this.page.getByTestId("longitudinal-capture-timeline");
  }

  milestone(stage: string): Locator {
    return this.page.getByTestId(`longitudinal-milestone-${stage}`);
  }

  async open(caseId: string): Promise<void> {
    await this.page.goto(`/cases/${caseId}/patient/follow-up`, {
      waitUntil: "domcontentloaded",
    });
    await expect(this.root()).toBeVisible({ timeout: 30_000 });
  }

  async openStage(stage: string): Promise<void> {
    await this.milestone(stage).click();
  }

  async expectMilestoneVisible(stage: string): Promise<void> {
    await expect(this.milestone(stage)).toBeVisible();
  }

  async expectStatusText(stage: string, pattern: RegExp | string): Promise<void> {
    await expect(this.milestone(stage)).toContainText(pattern);
  }
}
