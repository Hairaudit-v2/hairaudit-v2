/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Callback replay protection for ImagingOS webhooks.
 */

export type CallbackReplayStore = {
  seen: (key: string) => boolean | Promise<boolean>;
  mark: (key: string, ttlSeconds: number) => void | Promise<void>;
};

/** In-memory replay cache (process-local). Production may inject Redis-backed store. */
export function createMemoryCallbackReplayStore(): CallbackReplayStore {
  const map = new Map<string, number>();
  return {
    seen(key) {
      const exp = map.get(key);
      if (exp == null) return false;
      if (exp < Date.now()) {
        map.delete(key);
        return false;
      }
      return true;
    },
    mark(key, ttlSeconds) {
      map.set(key, Date.now() + ttlSeconds * 1000);
    },
  };
}

export type VerifyCallbackReplayResult =
  | { ok: true; replayKey: string }
  | { ok: false; code: "replay_detected"; message: string };

export async function assertCallbackNotReplayed(args: {
  store: CallbackReplayStore;
  providerResponseId: string;
  timestamp: string;
  caseId: string;
  ttlSeconds: number;
}): Promise<VerifyCallbackReplayResult> {
  const replayKey = `${args.caseId}:${args.providerResponseId}:${args.timestamp}`;
  if (await args.store.seen(replayKey)) {
    return {
      ok: false,
      code: "replay_detected",
      message: "ImagingOS callback replay detected",
    };
  }
  await args.store.mark(replayKey, args.ttlSeconds);
  return { ok: true, replayKey };
}

/**
 * Callbacks may only complete the case/projection named in the signed payload —
 * never mutate arbitrary cases.
 */
export function assertCallbackTargetsCase(args: {
  callbackCaseId: string;
  projectionCaseId: string;
}): { ok: true } | { ok: false; code: "case_mismatch"; message: string } {
  if (args.callbackCaseId !== args.projectionCaseId) {
    return {
      ok: false,
      code: "case_mismatch",
      message: "Callback caseId does not match projection case",
    };
  }
  return { ok: true };
}
