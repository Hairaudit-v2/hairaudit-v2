import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHaNexusSignatureMaterial,
  computeHaNexusHmacHex,
  evaluateHaNexusSignedRequest,
  signHaNexusRequestForTests,
} from "@/lib/nexus/haNexusWebhookAuth.server";

const SECRET = "ha-nexus-test-secret";

describe("haNexusWebhookAuth", () => {
  it("computes stable HMAC hex", () => {
    const material = buildHaNexusSignatureMaterial("1700000000", '{"a":1}');
    const sig = computeHaNexusHmacHex(SECRET, material);
    assert.equal(typeof sig, "string");
    assert.equal(sig.length, 64);
  });

  it("accepts valid signed request", () => {
    const rawBody = '{"ok":true}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const { signature } = signHaNexusRequestForTests({ secret: SECRET, timestamp, rawBody });
    const result = evaluateHaNexusSignedRequest({
      timestampHeader: timestamp,
      signatureHeader: signature,
      rawBody,
      secret: SECRET,
    });
    assert.equal(result.ok, true);
  });

  it("rejects invalid signature", () => {
    const result = evaluateHaNexusSignedRequest({
      timestampHeader: String(Math.floor(Date.now() / 1000)),
      signatureHeader: "00".repeat(32),
      rawBody: "{}",
      secret: SECRET,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.httpStatus, 401);
  });

  it("rejects timestamp skew", () => {
    const rawBody = "{}";
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    const { signature } = signHaNexusRequestForTests({ secret: SECRET, timestamp: stale, rawBody });
    const result = evaluateHaNexusSignedRequest({
      timestampHeader: stale,
      signatureHeader: signature,
      rawBody,
      secret: SECRET,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "timestamp_skew");
  });
});
