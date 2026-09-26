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

const run = (command) => execSync(command, { stdio: "inherit" });

run("prisma generate");
if (process.env.VERCEL_ENV === "production") {
  run("prisma migrate deploy");
}
run("next build");
