import "server-only";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { OtpPurpose, Role } from "@/generated/prisma/client";
import { normalizeSaudiPhone } from "@/lib/security/phone";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { isAcceptablePassword } from "@/lib/security/password-rules";
import { requestOtp, checkAndConsumeOtp, OtpRateLimitError } from "@/lib/otp/service";
import { writeAuditLog } from "@/lib/audit/service";
import { logger } from "@/lib/logger";
import { maskPhone, sha256Hex } from "@/lib/security/tokens";

/**
 * The private way in for the admin.
 *
 * Two factors, always: a password the admin knows and a code sent to the phone
 * the account is registered to. The public sign-in page cannot reach an admin
 * account at all, so this route is the only door.
 *
 * An admin with NO password does not get in on the SMS code alone. That used
 * to be the "recovery" state, and it made any seeded or cleared admin row
 * claimable by whoever held its phone. Now a password-less admin must present
 * an ENROLLMENT TOKEN in the password field — issued by an operator through
 * `pnpm admin:accounts enroll`, stored only as a hash, expiring, single-use —
 * plus the code, and must set a password in the same sign-in. No token, no
 * way in.
 *
 * Every attempt (password, enrollment token or code, right or wrong) is
 * CLAIMED from the account's attempt budget in one conditional UPDATE before
 * anything is checked, so concurrent guesses cannot outrun the lockout.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes, matching the door PIN's

export class AdminLoginError extends Error {}
export class AdminLoginLockedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many attempts");
  }
}

interface AdminAccount {
  id: string;
  passwordHash: string | null;
  adminEnrollmentHash: string | null;
  adminEnrollmentExpiresAt: Date | null;
}

/**
 * Returns the admin account for a phone, or null.
 *
 * Null covers "no such number", "not an admin" and "blocked" without saying
 * which. This route's whole value is being unadvertised; an error that
 * distinguishes a real admin number from a wrong one advertises it.
 */
async function findAdmin(phone: string): Promise<AdminAccount | null> {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      role: true,
      isBlocked: true,
      passwordHash: true,
      adminEnrollmentHash: true,
      adminEnrollmentExpiresAt: true,
    },
  });
  if (!user || user.role !== Role.ADMIN || user.isBlocked) return null;
  return user;
}

async function lockedError(adminId: string): Promise<AdminLoginLockedError> {
  const row = await prisma.user.findUnique({ where: { id: adminId }, select: { adminLoginLockedUntil: true } });
  const until = row?.adminLoginLockedUntil?.getTime() ?? Date.now() + LOCKOUT_MS;
  return new AdminLoginLockedError(Math.max(1, Math.ceil((until - Date.now()) / 1000)));
}

/** Locks the account unless it already is. Conditional, so parallel losers cannot extend it. */
async function lock(adminId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User"
       SET "adminLoginFailedAttempts" = 0,
           "adminLoginLockedUntil" = NOW() + ${LOCKOUT_MS} * INTERVAL '1 millisecond',
           "updatedAt" = NOW()
     WHERE "id" = ${adminId}
       AND ("adminLoginLockedUntil" IS NULL OR "adminLoginLockedUntil" <= NOW())
  `;
}

/**
 * Takes one attempt from the budget, or throws "locked". A single statement:
 * Postgres re-checks the lock and the count on the row it actually updates, so
 * a burst of N requests admits at most the attempts that remain.
 */
async function claimAttempt(adminId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ attempts: number }[]>`
    UPDATE "User"
       SET "adminLoginFailedAttempts" = "adminLoginFailedAttempts" + 1, "updatedAt" = NOW()
     WHERE "id" = ${adminId}
       AND ("adminLoginLockedUntil" IS NULL OR "adminLoginLockedUntil" <= NOW())
       AND "adminLoginFailedAttempts" < ${MAX_ATTEMPTS}
    RETURNING "adminLoginFailedAttempts" AS "attempts"
  `;
  if (!row) {
    // Budget spent without a lock recorded yet (the claims that spent it are
    // still in flight): record it now, so the account cannot sit exhausted
    // and unlocked forever.
    await lock(adminId);
    throw await lockedError(adminId);
  }
  return row.attempts;
}

/** A wrong answer on a claimed attempt: the last one in the budget locks the account. */
async function failAttempt(adminId: string, attempts: number, error: AdminLoginError): Promise<never> {
  if (attempts >= MAX_ATTEMPTS) {
    await lock(adminId);
    throw new AdminLoginLockedError(Math.ceil(LOCKOUT_MS / 1000));
  }
  throw error;
}

/**
 * A right answer: the counter returns to zero — but only if no parallel
 * failure locked the account in the meantime. A stale success must not
 * unlock what a concurrent failure just locked.
 */
async function succeedAttempt(adminId: string): Promise<void> {
  const reset = await prisma.$executeRaw`
    UPDATE "User"
       SET "adminLoginFailedAttempts" = 0, "adminLoginLockedUntil" = NULL, "updatedAt" = NOW()
     WHERE "id" = ${adminId}
       AND ("adminLoginLockedUntil" IS NULL OR "adminLoginLockedUntil" <= NOW())
  `;
  if (reset === 0) throw await lockedError(adminId);
}

function enrollmentMatches(admin: AdminAccount, token: string): boolean {
  if (!token || !admin.adminEnrollmentHash || !admin.adminEnrollmentExpiresAt) return false;
  if (admin.adminEnrollmentExpiresAt <= new Date()) return false;
  const supplied = Buffer.from(sha256Hex(token));
  const expected = Buffer.from(admin.adminEnrollmentHash);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export interface AdminChallengeResult {
  /** True when this account is enrolling — the caller must collect a new password. */
  needsPassword: boolean;
  /** Shown only for a test number with the bypass switched on. */
  devCode?: string;
  /** E.164, so the next step does not have to re-normalise the input. */
  phone: string;
}

/**
 * Step one: the password — or, for an account that has none yet, its
 * enrollment token — then a code to the phone.
 *
 * The secret is checked BEFORE any SMS goes out. Sending first would let
 * anyone who guesses the route spend the SMS balance, and would tell them
 * which numbers are admin accounts by which ones ring.
 */
export async function startAdminLogin(
  rawPhone: string,
  password: string,
): Promise<AdminChallengeResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) throw new AdminLoginError("invalid");

  const admin = await findAdmin(phone);
  if (!admin) {
    logger.warn("auth.admin_login.unknown_phone", { phone: maskPhone(phone) });
    throw new AdminLoginError("invalid");
  }

  const attempts = await claimAttempt(admin.id);
  const ok = admin.passwordHash
    ? await verifyPassword(password, admin.passwordHash)
    : enrollmentMatches(admin, password);
  if (!ok) await failAttempt(admin.id, attempts, new AdminLoginError("invalid"));
  await succeedAttempt(admin.id);

  try {
    const { devCode } = await requestOtp(phone, OtpPurpose.LOGIN);
    return { needsPassword: !admin.passwordHash, devCode, phone };
  } catch (err) {
    if (err instanceof OtpRateLimitError) throw err;
    throw new AdminLoginError("delivery");
  }
}

export interface AdminVerifyResult {
  userId: string;
  /** The password the admin set on this enrollment sign-in, already applied. */
  passwordWasSet: boolean;
}

/**
 * Step two: the code. Also where an enrolling admin sets their password — in
 * the same call, so the account cannot be left password-less afterwards by
 * closing the tab — and where the enrollment token is spent.
 */
export async function completeAdminLogin(
  rawPhone: string,
  code: string,
  newPassword: string | null,
  enrollmentToken: string | null = null,
): Promise<AdminVerifyResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) throw new AdminLoginError("invalid");

  const admin = await findAdmin(phone);
  if (!admin) throw new AdminLoginError("invalid");
  const enrolling = !admin.passwordHash;

  // An enrolling account must set a password here. Checked BEFORE the code:
  // with real SMS the provider spends the code on the first check, so refusing
  // afterwards would burn a code typed correctly.
  if (enrolling && (!newPassword || !isAcceptablePassword(newPassword))) {
    throw new AdminLoginError("password_required");
  }

  const attempts = await claimAttempt(admin.id);
  // The enrollment token again, checked before the code for the same reason.
  if (enrolling && !enrollmentMatches(admin, enrollmentToken ?? "")) {
    await failAttempt(admin.id, attempts, new AdminLoginError("invalid"));
  }

  const { valid } = await checkAndConsumeOtp(phone, OtpPurpose.LOGIN, code);
  if (!valid) await failAttempt(admin.id, attempts, new AdminLoginError("invalid_code"));
  await succeedAttempt(admin.id);

  if (enrolling && newPassword && enrollmentToken) {
    const passwordHash = await hashPassword(newPassword);
    // Spends the token and sets the password in ONE conditional write: only
    // while there is still no password and the very same unexpired token is
    // on the row. Two parallel enrollments cannot both land.
    const enrolled = await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ id: string; name: string }[]>`
        UPDATE "User"
           SET "passwordHash" = ${passwordHash},
               "adminEnrollmentHash" = NULL,
               "adminEnrollmentExpiresAt" = NULL,
               "updatedAt" = NOW()
         WHERE "id" = ${admin.id}
           AND "role" = 'ADMIN'
           AND "passwordHash" IS NULL
           AND "adminEnrollmentHash" = ${sha256Hex(enrollmentToken)}
           AND "adminEnrollmentExpiresAt" > NOW()
        RETURNING "id", "name"
      `;
      if (!row) return false;
      await writeAuditLog(tx, {
        actor: { id: row.id, name: row.name, role: Role.ADMIN },
        action: "user.admin_enrollment.completed",
        entityType: "User",
        entityId: row.id,
      });
      return true;
    });
    if (!enrolled) throw new AdminLoginError("invalid");
    logger.warn("auth.admin_login.enrolled", { phone: maskPhone(phone) });
    return { userId: admin.id, passwordWasSet: true };
  }

  logger.info("auth.admin_login.success", { phone: maskPhone(phone) });
  return { userId: admin.id, passwordWasSet: false };
}

/**
 * Changing the password from inside the panel, where the admin is already
 * signed in. This is how the FIRST password gets set, before the public page
 * stops accepting admins — doing it the other way round locks them out.
 */
export async function setAdminPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!isAcceptablePassword(newPassword)) throw new AdminLoginError("password_weak");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordHash: true },
  });
  if (!user || user.role !== Role.ADMIN) throw new AdminLoginError("invalid");

  // Only asked for once one exists: the first time there is nothing to prove,
  // and being signed in as the admin already is the proof.
  if (user.passwordHash && !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AdminLoginError("current_wrong");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      adminLoginFailedAttempts: 0,
      adminLoginLockedUntil: null,
      // A password now exists, so any outstanding enrollment token is moot.
      adminEnrollmentHash: null,
      adminEnrollmentExpiresAt: null,
    },
  });
  logger.warn("auth.admin_password.changed", { userId });
}

export async function adminHasPassword(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return Boolean(user?.passwordHash);
}
