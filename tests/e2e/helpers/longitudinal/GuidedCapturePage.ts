/**
 * FI-OUTCOME-INTELLIGENCE-1F — Guided capture wizard page object.
 */

import type { Page, Locator } from "playwright/test";
import { expect } from "playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  roleToSyntheticImage,
  syntheticImagePath,
  type SyntheticImageRole,
} from "../../../fixtures/longitudinalE2e/syntheticImagePaths";

export class GuidedCapturePage {
  constructor(private readonly page: Page) {}

  wizard(): Locator {
    return this.page.getByTestId("guided-capture-wizard");
  }

  progress(): Locator {
    return this.page.getByTestId("guided-capture-progress");
  }

  statusMessage(): Locator {
    return this.page.getByTestId("guided-capture-status-message");
  }

  primaryCta(): Locator {
    return this.page.getByTestId("guided-capture-primary-cta");
  }

  viewStep(): Locator {
    return this.page.getByTestId("guided-capture-view-step");
  }

  choosePhoto(): Locator {
    return this.page.getByTestId("guided-capture-choose-photo");
  }

  continueBtn(): Locator {
    return this.page.getByTestId("guided-capture-continue");
  }

  skipRecommended(): Locator {
    return this.page.getByTestId("guided-capture-skip-recommended");
  }

  finishBtn(): Locator {
    return this.page.getByTestId("guided-capture-finish");
  }

  complete(): Locator {
    return this.page.getByTestId("guided-capture-complete");
  }

  reference(): Locator {
    return this.page.getByTestId("guided-capture-reference");
  }

  viewReview(): Locator {
    return this.page.getByTestId("guided-capture-view-review");
  }

  async open(caseId: string, stage: string): Promise<void> {
    await this.page.goto(`/cases/${caseId}/patient/follow-up/${stage}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(this.wizard()).toBeVisible({ timeout: 45_000 });
  }

  async openHref(href: string): Promise<void> {
    await this.page.goto(href, { waitUntil: "domcontentloaded" });
    await expect(this.wizard()).toBeVisible({ timeout: 45_000 });
  }

  async startCapture(): Promise<void> {
    const cta = this.primaryCta();
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
    }
  }

  async expectProgress(requiredComplete: number, requiredTotal: number): Promise<void> {
    await expect(this.progress()).toContainText(
      `${requiredComplete} / ${requiredTotal}`
    );
  }

  async expectViewLabel(label: string | RegExp): Promise<void> {
    await expect(this.viewStep()).toContainText(label);
  }

  async expectNoCrownInRequiredList(): Promise<void> {
    const body = await this.wizard().innerText();
    // Crown may appear in guidance elsewhere; required list uses "Crown View".
    // Assert via guided-capture API instead when needed; here check progress label context.
    expect(body).not.toMatch(/Crown View[\s\S]{0,40}Required/i);
  }

  async uploadCurrentView(roleHint?: string): Promise<void> {
    const imgRole: SyntheticImageRole = roleHint
      ? roleToSyntheticImage(
          roleHint.startsWith("followup_") ? roleHint : roleHint
        )
      : "front";
    const filePath = syntheticImagePath(imgRole);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Missing synthetic image ${filePath}. Run: FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed`
      );
    }

    const libraryInput = this.page.locator(
      'input[type="file"][aria-label^="Choose existing photo"]'
    );
    await this.choosePhoto().click();
    await libraryInput.setInputFiles(filePath);

    // Wait for continue (upload success) or progress refresh — no arbitrary long sleep.
    await expect(this.continueBtn().or(this.progress())).toBeVisible({
      timeout: 45_000,
    });
  }

  async uploadAndContinue(roleHint?: string): Promise<void> {
    await this.uploadCurrentView(roleHint);
    const cont = this.continueBtn();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click();
    }
  }

  async replaceCurrentView(roleHint?: string): Promise<void> {
    await this.uploadCurrentView(roleHint);
  }

  async skipRecommendedIfPresent(): Promise<void> {
    const skip = this.skipRecommended();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
    }
  }

  async finishRequired(): Promise<void> {
    const review = this.page.getByTestId("guided-capture-review");
    if (await review.isVisible().catch(() => false)) {
      await this.finishBtn().click();
    }
    await expect(this.complete()).toBeVisible({ timeout: 30_000 });
  }

  async completeAllRequired(requiredTotal: number): Promise<void> {
    await this.startCapture();
    for (let i = 0; i < requiredTotal + 2; i++) {
      if (await this.complete().isVisible().catch(() => false)) return;
      if (await this.page.getByTestId("guided-capture-review").isVisible().catch(() => false)) {
        await this.finishBtn().click();
        await expect(this.complete()).toBeVisible({ timeout: 20_000 });
        return;
      }
      if (await this.viewStep().isVisible().catch(() => false)) {
        const label = (await this.viewStep().innerText()).toLowerCase();
        let hint = "front";
        if (label.includes("top")) hint = "top";
        else if (label.includes("crown")) hint = "crown";
        else if (label.includes("recipient")) hint = "recipient_closeup";
        else if (label.includes("donor")) hint = "donor_rear";
        else if (label.includes("left")) hint = "left";
        else if (label.includes("right")) hint = "right";
        await this.uploadAndContinue(hint);
        continue;
      }
      break;
    }
  }

  async expectReferencePanel(): Promise<void> {
    await expect(this.reference()).toBeVisible();
    await expect(this.reference()).toContainText(/Try to match this angle/i);
    const html = await this.reference().innerHTML();
    expect(html).not.toMatch(/cases\/[0-9a-f-]{36}\//i);
    expect(html).not.toMatch(/storage\/v1\/object\/public/i);
  }

  async pollGuidedApi(
    caseId: string,
    stage: string,
    predicate: (json: Record<string, unknown>) => boolean,
    timeoutMs = 45_000
  ): Promise<Record<string, unknown>> {
    let last: Record<string, unknown> = {};
    await expect
      .poll(
        async () => {
          const res = await this.page.request.get(
            `/api/patient/cases/${encodeURIComponent(caseId)}/guided-capture?stage=${encodeURIComponent(stage)}`
          );
          if (!res.ok()) return false;
          last = (await res.json()) as Record<string, unknown>;
          return predicate(last);
        },
        { timeout: timeoutMs, intervals: [300, 500, 1000] }
      )
      .toBe(true);
    return last;
  }
}

/** Absolute path helper for specs that setInputFiles directly. */
export function longitudinalFixtureImage(role: SyntheticImageRole): string {
  return path.resolve(syntheticImagePath(role));
}
