import type { NextConfig } from "next";
import { defaultLocale, locales } from "@/lib/i18n/locales";
import { SESSION_COOKIE } from "@/lib/auth/cookie-names";

const nextConfig: NextConfig = {
  // Lets the dev server be reached from a phone on the same Wi-Fi (e.g. http://192.168.x.x:3000)
  // without Next.js blocking its own JS chunk/HMR requests as cross-origin.
  allowedDevOrigins: process.env.DEV_LAN_ORIGIN ? [process.env.DEV_LAN_ORIGIN] : undefined,
  // Replaces the old proxy.ts (Next 16's Proxy/Middleware always runs in the
  // Node.js runtime now, which Cloudflare Workers can't run) — a plain
  // declarative redirect needs no runtime JS at all, so it sidesteps that
  // restriction entirely instead of fighting it.
  async redirects() {
    return [{ source: "/", destination: `/${defaultLocale}`, permanent: false }];
  },
  // The admin sign-in keeps its short, unlisted address while the page itself
  // lives under `/[locale]` — where Next.js does not print its folder name into
  // every page's flight payload the way it must for a root-level sibling of a
  // dynamic segment. A rewrite is server-side only, so the path it maps from
  // never reaches the browser bundle either.
  async rewrites() {
    return {
      beforeFiles: [
        // The design gallery is a static file of the PUBLIC designs, so the
        // CDN can hand it out without waking a function. A signed-in customer
        // may also own private ones (a paid custom design), so anyone holding
        // a session cookie is served the per-request twin instead — resolved
        // at the edge, with `/themes` still in the address bar.
        {
          source: `/:locale(${locales.join("|")})/themes`,
          has: [{ type: "cookie", key: SESSION_COOKIE }],
          destination: "/:locale/themes/mine",
        },
      ],
      afterFiles: [{ source: "/sultannatlus", destination: `/${defaultLocale}/sultannatlus` }],
      fallback: [],
    };
  },
  // Nothing on the server reads `public/` at run time — the CDN serves it — but
  // the theme-storage module's local-disk fallback builds paths from
  // `process.cwd()/public`, and the tracer answers that by copying the whole
  // folder into EVERY function: 222 MB of design art per route, which is what
  // a cold start was loading. The fallback only ever runs in local
  // development, where nothing is traced.
  outputFileTracingExcludes: {
    "/*": ["public/**/*"],
  },
  images: {
    // AVIF first, WebP second. Theme art is photographic, which is exactly what
    // AVIF is best at — the same envelope lands at roughly a third of its JPEG
    // size — and a browser that cannot read it falls through to WebP.
    formats: ["image/avif", "image/webp"],
    // Artwork uploaded from the theme builder lives on Vercel Blob, so the
    // optimizer has to be allowed to fetch it; without this every builder
    // design's image throws instead of rendering.
    //
    // Pinned to THIS store's own hostname, not `*.public.blob.vercel-storage.com`:
    // the wildcard let any Vercel account's blob store feed our image optimizer,
    // turning `/_next/image` into an open proxy (billable transforms, attacker
    // images served under our domain, and the AVIF-decode input path). The store
    // id is public — it is in every image URL the site already serves.
    remotePatterns: [
      { protocol: "https", hostname: "2wdnnxymntbtqxr7.public.blob.vercel-storage.com" },
    ],
  },
  // The framework version is not something a visitor needs, and naming it just
  // points an attacker straight at the matching advisories.
  poweredByHeader: false,
  // Response headers applied to every route. Kept deliberately conservative so
  // nothing here can break a working page: it hardens framing, sniffing,
  // referrer and transport, and sets the CSP directives that never depend on
  // knowing every inline script (`frame-ancestors`, `base-uri`, `object-src`).
  // A full `script-src`/`style-src` policy needs nonces and per-page testing and
  // is intentionally left for a separate pass.
  async headers() {
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // The gate scanner reads the camera on our own origin; nothing else needs
      // a powerful feature, so everything else is denied outright.
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
      },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
      },
    ];
    // A per-guest invitation link is not a public page — keep it out of search
    // indexes at the header level too, not only via page metadata (a crawler
    // that fetches the RSC payload or a sub-resource never sees the <meta>).
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/i/:path*", headers: noindex },
      { source: "/t/:path*", headers: noindex },
      { source: "/preview/:path*", headers: noindex },
    ];
  },
  // Inlined as a literal at build time (see lib/db/client.ts) so the Cloudflare
  // build can dead-code-eliminate the `pg` driver branch entirely instead of
  // trying to bundle it.
  env: {
    DB_ADAPTER: process.env.DB_ADAPTER ?? "pg",
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
