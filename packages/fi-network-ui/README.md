# fi-network-ui (vendored)

Follicle Intelligence Network marketing UI components, **vendored** from the Follicle Intelligence monorepo (`follicleintelligence/packages/ui`) so HairAudit CI/Vercel can build without a sibling checkout.

**Sync:** When the upstream package changes, copy it here again (or replace this tree) and keep `src/lib/fi-ui/network-ui.ts` re-exports aligned with what HairAudit imports.

Host app expectations (unchanged from upstream): `@/lib/utils` (`cn`), Next.js `Link`, and Tailwind semantic tokens wired in `src/app/globals.css`.
