/**
 * Operator commands for privileged accounts. The only way an admin comes into
 * existence outside a local demo seed.
 *
 *   pnpm admin:accounts list
 *       Read-only audit of every ADMIN and GATE_STAFF row: password set or not,
 *       enrollment pending, blocked, live sessions, and whether the phone is one
 *       of the fixed demo numbers an old `db:seed` used to create everywhere.
 *
 *   pnpm admin:accounts enroll <phone> [--name "…"] [--promote] [--reset-password] [--hours N]
 *       Issues a single-use enrollment token (default 24h, at most 72h) and
 *       prints it ONCE. The admin types it into the password field of the
 *       private sign-in, receives an SMS code, and sets a password — all three
 *       in one sign-in. Creates the admin if the phone has no account.
 *       --promote        required to turn an existing non-admin account into one
 *       --reset-password required to replace an existing password (recovery);
 *                        also ends every live session of that account
 *
 *   pnpm admin:accounts revoke <phone> --confirm
 *       Demotes an ADMIN or GATE_STAFF account to CUSTOMER, clears its password
 *       and any enrollment, and ends every live session. The row itself is kept
 *       (its orders, events and audit trail still point at it).
 *
 * Every mutation writes an AuditLog row. Nothing here sends an SMS or touches a
 * payment provider.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeSaudiPhone } from "../src/lib/security/phone";

const DEMO_PHONES = new Set(["+966500000001", "+966500000002"]);
const DEFAULT_TTL_HOURS = 24;
const MAX_TTL_HOURS = 72;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function mask(phone: string | null): string {
  if (!phone) return "(none)";
  return phone.length <= 3 ? "***" : `${"*".repeat(phone.length - 3)}${phone.slice(-3)}`;
}

function flag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function requirePhone(raw: string | undefined): string {
  const phone = raw ? normalizeSaudiPhone(raw) : null;
  if (!phone) fail("A valid Saudi mobile number is required, e.g. 05XXXXXXXX or +9665XXXXXXXX.");
  if (DEMO_PHONES.has(phone) && !flag(process.argv, "allow-demo-number")) {
    fail(`${phone} is a fixed demo number. Privileged access is never given to it outside local development (--allow-demo-number).`);
  }
  return phone;
}

async function audit(action: string, userId: string, meta: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorId: null,
      action,
      entityType: "User",
      entityId: userId,
      meta: { ...meta, actorName: process.env.USER ?? "operator", actorRole: "OPERATOR_CLI" },
    },
  });
}

async function list() {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.GATE_STAFF] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      name: true,
      phone: true,
      isBlocked: true,
      passwordHash: true,
      adminEnrollmentExpiresAt: true,
      createdAt: true,
      _count: { select: { sessions: { where: { expiresAt: { gt: now } } } } },
    },
  });
  console.table(
    users.map((u) => ({
      id: u.id,
      role: u.role,
      name: u.name,
      phone: mask(u.phone),
      demoNumber: u.phone ? DEMO_PHONES.has(u.phone) : false,
      password: u.role === Role.ADMIN ? Boolean(u.passwordHash) : "n/a",
      enrollment: !u.adminEnrollmentExpiresAt
        ? "-"
        : u.adminEnrollmentExpiresAt > now
          ? `pending until ${u.adminEnrollmentExpiresAt.toISOString()}`
          : "expired",
      blocked: u.isBlocked,
      liveSessions: u._count.sessions,
      created: u.createdAt.toISOString().slice(0, 10),
    })),
  );
  const risky = users.filter((u) => u.phone && DEMO_PHONES.has(u.phone));
  if (risky.length > 0) {
    console.warn(
      `\n${risky.length} privileged account(s) use a fixed demo number. If this is a shared or production database, ` +
        "run `pnpm admin:accounts revoke <phone> --confirm` for each after enrolling a real operator.",
    );
  }
}

async function enroll(args: string[]) {
  const phone = requirePhone(args[0]);
  const hours = Number(option(args, "hours") ?? DEFAULT_TTL_HOURS);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_TTL_HOURS) {
    fail(`--hours must be between 1 and ${MAX_TTL_HOURS}.`);
  }

  const token = randomBytes(32).toString("base64url");
  const enrollment = {
    adminEnrollmentHash: createHash("sha256").update(token).digest("hex"),
    adminEnrollmentExpiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    adminLoginFailedAttempts: 0,
    adminLoginLockedUntil: null,
  };

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true, passwordHash: true, isBlocked: true },
  });

  let userId: string;
  if (!existing) {
    const name = option(args, "name");
    if (!name || name.trim().length < 2) fail("A new admin needs --name.");
    const created = await prisma.user.create({
      data: { phone, name: name.trim(), role: Role.ADMIN, phoneVerifiedAt: new Date(), ...enrollment },
      select: { id: true },
    });
    userId = created.id;
    await audit("user.admin_enrollment.issued", userId, { created: true, hours });
  } else {
    if (existing.isBlocked) fail("That account is blocked. Unblock it deliberately first.");
    if (existing.role !== Role.ADMIN && !flag(args, "promote")) {
      fail(`That account is ${existing.role}. Pass --promote to make it an admin.`);
    }
    if (existing.passwordHash && !flag(args, "reset-password")) {
      fail("That admin already has a password. Pass --reset-password to replace it (recovery).");
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { role: Role.ADMIN, passwordHash: null, ...enrollment },
      }),
      // A reset exists because the old password is not trusted; neither are
      // the sessions it opened.
      ...(existing.passwordHash ? [prisma.session.deleteMany({ where: { userId: existing.id } })] : []),
    ]);
    userId = existing.id;
    await audit("user.admin_enrollment.issued", userId, {
      promotedFrom: existing.role !== Role.ADMIN ? existing.role : undefined,
      passwordReset: Boolean(existing.passwordHash),
      hours,
    });
  }

  console.log(`Enrollment token for ${mask(phone)} (single use, expires in ${hours}h). Share it over a trusted channel:\n\n  ${token}\n`);
  console.log("The admin enters it in the password field of the private sign-in, then the SMS code, then a new password.");
}

async function revoke(args: string[]) {
  const phone = requirePhone(args[0]);
  if (!flag(args, "confirm")) fail("Revoking is deliberate: pass --confirm.");

  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, role: true } });
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.GATE_STAFF)) {
    fail("No ADMIN or GATE_STAFF account has that phone.");
  }

  const [, sessions] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: Role.CUSTOMER,
        passwordHash: null,
        adminEnrollmentHash: null,
        adminEnrollmentExpiresAt: null,
        adminLoginFailedAttempts: 0,
        adminLoginLockedUntil: null,
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit("user.privileges.revoked", user.id, { from: user.role, sessionsEnded: sessions.count });
  console.log(`${mask(phone)}: ${user.role} → CUSTOMER, ${sessions.count} session(s) ended.`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "list") return list();
  if (command === "enroll") return enroll(args);
  if (command === "revoke") return revoke(args);
  fail("Usage: pnpm admin:accounts list | enroll <phone> [--name …] [--promote] [--reset-password] [--hours N] | revoke <phone> --confirm");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
