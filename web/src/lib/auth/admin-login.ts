import "server-only";
import { prisma } from "@/lib/db/client";
import { OtpPurpose, Role } from "@/generated/prisma/client";
import { normalizeSaudiPhone } from "@/lib/security/phone";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { isAcceptablePassword } from "@/lib/security/password-rules";
import { requestOtp, peekOtp, consumeOtp, OtpRateLimitError } from "@/lib/otp/service";
import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/security/tokens";

/**
 * The private way in for the admin.
 *
 * Two factors, always: a password the admin knows and a code sent to the phone
 * the account is registered to. The public sign-in page cannot reach an admin
 * account at all, so this route is the only door.
 *
 * The one state that looks like a hole and is not: an admin with NO password
 * set can sign in with the SMS code alone, and is made to set one immediately.
 * That is the recovery path, and reaching it requires clearing `passwordHash`
 * in the database — so recovery costs database access AND the phone, which is
 * two factors of a different kind.
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
  adminLoginFailedAttempts: number;
  adminLoginLockedUntil: Date | null;
  isBlocked: boolean;
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
      adminLoginFailedAttempts: true,
      adminLoginLockedUntil: true,
    },
  });
  if (!user || user.role !== Role.ADMIN || user.isBlocked) return null;
  return user;
}

function assertNotLocked(admin: AdminAccount) {
  if (admin.adminLoginLockedUntil && admin.adminLoginLockedUntil > new Date()) {
    const seconds = Math.ceil((admin.adminLoginLockedUntil.getTime() - Date.now()) / 1000);
    throw new AdminLoginLockedError(Math.max(1, seconds));
  }
}

async function countFailure(admin: AdminAccount) {
  const attempts = admin.adminLoginFailedAttempts + 1;
  const lockedOut = attempts >= MAX_ATTEMPTS;
  await prisma.user.update({
    where: { id: admin.id },
    data: lockedOut
      ? { adminLoginFailedAttempts: 0, adminLoginLockedUntil: new Date(Date.now() + LOCKOUT_MS) }
      : { adminLoginFailedAttempts: attempts },
  });
  if (lockedOut) throw new AdminLoginLockedError(Math.ceil(LOCKOUT_MS / 1000));
}

export interface AdminChallengeResult {
  /** True when this account has no password yet — the caller must collect one. */
  needsPassword: boolean;
  /** Shown only for a test number with the bypass switched on. */
  devCode?: string;
  /** E.164, so the next step does not have to re-normalise the input. */
  phone: string;
}

/**
 * Step one: password (when one is set), then a code to the phone.
 *
 * The password is checked BEFORE any SMS goes out. Sending first would let
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

  assertNotLocked(admin);

  if (admin.passwordHash) {
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) {
      await countFailure(admin);
      throw new AdminLoginError("invalid");
    }
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { adminLoginFailedAttempts: 0, adminLoginLockedUntil: null },
  });

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
  /** The password the admin set on this recovery sign-in, already applied. */
  passwordWasSet: boolean;
}

/**
 * Step two: the code. Also where a recovering admin sets their new password —
 * in the same call, so the account cannot be left password-less afterwards by
 * closing the tab.
 */
export async function completeAdminLogin(
  rawPhone: string,
  code: string,
  newPassword: string | null,
): Promise<AdminVerifyResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) throw new AdminLoginError("invalid");

  const admin = await findAdmin(phone);
  if (!admin) throw new AdminLoginError("invalid");
  assertNotLocked(admin);

  // A password-less account is being recovered, so one must be set here. The
  // check is repeated on the server because the form's own rule is only a hint,
  // and it runs BEFORE the code is checked: with real SMS the provider spends
  // the code on the first check, so refusing afterwards would burn a code the
  // customer typed correctly and make them wait for another.
  if (!admin.passwordHash && (!newPassword || !isAcceptablePassword(newPassword))) {
    throw new AdminLoginError("password_required");
  }

  const { valid, otpId } = await peekOtp(phone, OtpPurpose.LOGIN, code.trim());
  if (!valid || !otpId) {
    await countFailure(admin);
    throw new AdminLoginError("invalid_code");
  }

  await consumeOtp(otpId);

  if (!admin.passwordHash && newPassword) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    logger.warn("auth.admin_login.password_set_on_recovery", { phone: maskPhone(phone) });
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
