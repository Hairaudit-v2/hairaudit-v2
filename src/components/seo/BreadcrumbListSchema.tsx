import { getBaseUrl } from "@/lib/seo/baseUrl";

export type BreadcrumbSchemaItem = {
  name: string;
  /** Path beginning with / */
  pathname: string;
};

/**
 * BreadcrumbList JSON-LD for eligible marketing pages.
 */
export default function BreadcrumbListSchema({ items }: { items: BreadcrumbSchemaItem[] }) {
  if (items.length === 0) return null;
  const base = getBaseUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const path = item.pathname.startsWith("/") ? item.pathname : `/${item.pathname}`;
      return {
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: `${base}${path}`,
      };
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
