import { getBaseUrl } from "@/lib/seo/baseUrl";

/**
 * Organization and WebSite JSON-LD for the homepage.
 * Factual only; no ratings or medical certifications.
 */
export default function OrganizationWebSiteSchema() {
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/hairaudit-logo.svg`;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HairAudit",
    url: baseUrl,
    logo: logoUrl,
  };

  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HairAudit",
    url: baseUrl,
    description:
      "Independent, evidence-based hair transplant review for patients and professionals.",
    publisher: {
      "@type": "Organization",
      name: "HairAudit",
      url: baseUrl,
      logo: logoUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite) }}
      />
    </>
  );
}
