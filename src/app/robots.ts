import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? "https://hairaudit.com").replace(
      /\/+$/,
      ""
    );

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/beta-access-message",
          "/request-audit",
          "/verified-program",
          "/admin/",
          "/dashboard/",
          "/cases/",
          "/api/",
          "/dev",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
