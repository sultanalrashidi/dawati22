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
  // Inlined as a literal at build time (see lib/db/client.ts) so the Cloudflare
  // build can dead-code-eliminate the `pg` driver branch entirely instead of
  // trying to bundle it.
  env: {
    DB_ADAPTER: process.env.DB_ADAPTER ?? "pg",
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
