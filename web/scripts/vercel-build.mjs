/**
 * Vercel's build (`vercel-build` takes precedence over `build` there).
 *
 * On a PRODUCTION deploy the database migrations are applied before the app is
 * built, so new code never goes live against a database missing its columns.
 * If a migration fails the build fails, and Vercel keeps serving the previous
 * deployment — the safe way to fail. Preview builds do not migrate: they share
 * the production database, and only a production deploy may change it.
 */
import { execSync } from "node:child_process";

const run = (command, env = process.env) => execSync(command, { stdio: "inherit", env });

/**
 * Migrations go over a DIRECT connection, not Neon's `-pooler` host. Migrate
 * holds a session-level advisory lock, and through the pooler's transaction
 * mode the unlock can land on a different server connection than the lock —
 * the lock is then left held on a pooled connection, and every later deploy
 * times out waiting for it (P1002). Neon's direct host is the pooled one
 * without `-pooler`; an explicit DATABASE_URL_UNPOOLED wins when set.
 *
 * The advisory lock itself is skipped: one production build runs per push,
 * and a lock orphaned on a pooled connection must not keep blocking deploys.
 */
function migrateEnv() {
  const pooled = process.env.DATABASE_URL ?? "";
  const direct = process.env.DATABASE_URL_UNPOOLED || pooled.replace("-pooler.", ".");
  return { ...process.env, DATABASE_URL: direct, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" };
}

run("prisma generate");
if (process.env.VERCEL_ENV === "production") {
  run("prisma migrate deploy", migrateEnv());
}
run("next build");
