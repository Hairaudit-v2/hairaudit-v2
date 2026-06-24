import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLongTermHairPreservationContent,
  isLongTermHairPreservationContent,
  renderLongTermHairPreservationHtml,
} from "../src/lib/reports/longTermHairPreservation";

describe("longTermHairPreservation", () => {
  it("builds pathway-specific context for pre-surgery", () => {
    const content = buildLongTermHairPreservationContent("pre_surgery");
    assert.equal(content.title, "Long-Term Hair Preservation Strategy");
    assert.equal(content.pathwayContext, "Planning future long-term preservation");
    assert.equal(content.subsections.length, 4);
    assert.match(content.safetyStatement, /does not prescribe treatment/i);
    const regenerative = content.subsections.find((s) => s.id === "regenerative");
    assert.ok(regenerative?.intro.includes("before or alongside surgical treatment"));
  });

  it("builds pathway-specific context for post-surgery", () => {
    const content = buildLongTermHairPreservationContent("post_surgery");
    assert.equal(content.pathwayContext, "Protecting your post-transplant result");
    const regenerative = content.subsections.find((s) => s.id === "regenerative");
    assert.ok(regenerative?.intro.includes("following transplantation"));
  });

  it("renders educational subsections and mandatory safety statement in PDF HTML", () => {
    const html = renderLongTermHairPreservationHtml(
      buildLongTermHairPreservationContent("post_surgery")
    );
    assert.match(html, /Long-Term Hair Preservation Strategy/);
    assert.match(html, /Medical Hair Loss Prevention Options/);
    assert.match(html, /Natural Hair Preservation Support/);
    assert.match(html, /Regenerative Hair Support Options/);
    assert.match(html, /Monitoring Future Hair Loss Progression/);
    assert.match(html, /Finasteride/);
    assert.match(html, /does not prescribe treatment/i);
    assert.match(html, /GP, prescribing doctor, or qualified treating clinician/);
  });

  it("validates stored preservation content shape", () => {
    const content = buildLongTermHairPreservationContent("post_surgery");
    assert.equal(isLongTermHairPreservationContent(content), true);
    assert.equal(isLongTermHairPreservationContent({}), false);
    assert.equal(isLongTermHairPreservationContent(null), false);
  });
});
