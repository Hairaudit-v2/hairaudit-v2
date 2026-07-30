/**
 * Shared cases segment shell.
 *
 * Auth + chrome for `/cases/[caseId]/*` live in `cases/[caseId]/layout.tsx`
 * so unauthenticated visitors get `next=/cases/:id` (not the dashboard
 * fallback from a missing middleware `x-pathname`).
 *
 * The index route (`/cases`) redirects in `page.tsx` and does not need chrome.
 */
export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
