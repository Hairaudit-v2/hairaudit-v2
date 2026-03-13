import type { Metadata } from "next";

type PageMetadataInput = {
  title: string;
  description: string;
  pathname: string;
  noindex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  pathname,
  noindex = false,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: pathname,
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
