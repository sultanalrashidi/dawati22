import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Two driver adapters, picked at build time via next.config.ts's `env.DB_ADAPTER`
 * (a literal Next.js inlines everywhere, so the dead branch below is fully
 * eliminated — not just skipped at runtime). Local dev / Node hosting keeps
 * using `pg` over a plain TCP connection to Postgres; the Cloudflare Workers
 * build uses Neon's HTTP/WebSocket driver instead, because `pg`'s raw TCP
 * socket path pulls in `pg-cloudflare`, which OpenNext's bundler can't
 * resolve — Workers has no way to run that dependency's native bits anyway.
 * require() (not a static import) is what actually lets the bundler drop
 * the unused branch entirely instead of trying to bundle both drivers.
 */
function createClient() {
  if (process.env.DB_ADAPTER === "neon") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see comment above
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
    return new PrismaClient({ adapter });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see comment above
  const { PrismaPg } = require("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
