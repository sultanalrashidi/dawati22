import type { MetadataRoute } from "next";

/**
 * The public crawl rules.
 *
 * Guest invitations (`/i`), the owner's test preview (`/t`), the pre-pay draft
 * preview (`/preview`) and the API are all token- or session-gated and have no
 * business in a search index — a single leaked link should not become a
 * crawlable page carrying a guest's name. They are disallowed here in addition
 * to the per-route `X-Robots-Tag: noindex` header and page metadata.
 *
 * The unlisted admin sign-in path is deliberately NOT named here: robots.txt is
 * public, and listing it would hand every reader the one address the route's
 * whole protection is being unadvertised.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/i/", "/t/", "/preview/", "/api/"],
      },
    ],
  };
}
