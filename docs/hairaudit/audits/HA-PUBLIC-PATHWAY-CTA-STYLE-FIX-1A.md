# HA-PUBLIC-PATHWAY-CTA-STYLE-FIX-1A — Evidence

**Date:** 2026-08-06  
**Status:** GREEN (unit suite)  
**Scope:** Restore Pre-Surgery Review as the gold primary public CTA; keep Post-Surgery as secondary; block anonymous-disabled styling regressions.

---

## Root cause

Two compounding issues on the HairAudit homepage (`HairAuditNetworkHomePage` → `PatientPathwayChooser`):

1. **Inverted hero hierarchy** — `isPrimary = pathway === "post_surgery"` made Post-Surgery gold-candidate and Pre-Surgery `secondary` (muted glass).
2. **Glass “primary” token** — `fiHairauditPrimaryButtonClass` wrapped the network glass primary (`from-white/14` translucent fill), which reads as inactive/grey on the dark shell rather than HairAudit gold.

`StartFreeAuditButton` was **not** gating on `!profile` / `!user`; `disabled={busy}` only. No auth-loading permanent mute.

---

## Fix

| Piece | Change |
|-------|--------|
| `fiHairauditPrimaryButtonClass` | Explicit amber-500 / slate-900 gold CTA (no glass gradient) |
| `fiHairauditSecondaryButtonClass` | Transparent + visible border + white label |
| `isPathwayCtaPrimary` | Pre-Surgery primary by default; donor-entry may elevate Post-Surgery |
| `PatientPathwayChooser` | Hero + cards use hierarchy helper; Pathway A badge accent |
| `StartFreeAuditButton` | Unchanged routing/auth handoff contract |

---

## Regression coverage

```bash
pnpm tsx --test tests/publicPathwayCtaStyle.test.ts
```

- Pre-Surgery primary by default; Post-Surgery secondary
- Donor-entry highlight elevates Post-Surgery
- Gold primary classes present; glass gradient absent
- Secondary distinct from gold
- Source guards: no `disabled={!profile\|!user}`; chooser uses hierarchy helper

E2E (`tests/e2e/hairaudit/pathway-chooser.spec.ts`): enabled CTAs + Pre-Surgery has `bg-amber-500`.

---

## Acceptance

- [x] Pre-Surgery Review is gold primary in hero
- [x] Post-Surgery Audit is secondary/outline, still actionable
- [x] Styling not dependent on profile existence
- [x] Pathway routing / authorization unchanged
- [x] Brief busy “Starting…” still the only disable path
