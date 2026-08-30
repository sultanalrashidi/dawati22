import type { NextConfig } from "next";
import { defaultLocale } from "@/lib/i18n/locales";

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
    return [
      { source: "/sultannatlus", destination: `/${defaultLocale}/sultannatlus` },
    ];
  },
  images: {
    // AVIF first, WebP second. Theme art is photographic, which is exactly what
    // AVIF is best at — the same envelope lands at roughly a third of its JPEG
    // size — and a browser that cannot read it falls through to WebP.
    formats: ["image/avif", "image/webp"],
    // Artwork uploaded from the theme builder lives on Vercel Blob, so the
    // optimizer has to be allowed to fetch it; without this every builder
    // design's image throws instead of rendering.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
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
