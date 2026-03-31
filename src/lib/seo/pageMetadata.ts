import type { Metadata } from "next";

type PageMetadataInput = {
  title: string;
  description: string;
  pathname: string;
  noindex?: boolean;
  canonicalPathname?: string;
  languageAlternates?: Record<string, string>;
};

/**
 * Shared App Router metadata: canonical, robots, Open Graph, and Twitter.
 * - **`pathname`**: site path starting with `/` (no origin). Next.js joins `openGraph.url` and
 *   `alternates.canonical` with root `metadataBase` from `app/layout.tsx` → absolute URLs in HTML.
 * - **Do not** pass full origins into `pathname` / `canonicalPathname` unless you intentionally
 *   override that behavior.
 */
export function createPageMetadata({
  title,
  description,
  pathname,
  noindex = false,
  canonicalPathname,
  languageAlternates,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: canonicalPathname ?? pathname,
      languages: languageAlternates,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: pathname,
      siteName: "HairAudit",
      images: [
        {
          url: "/hairaudit-logo.svg",
          alt: "HairAudit",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/hairaudit-logo.svg"],
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}
