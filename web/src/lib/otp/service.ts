import "server-only";
import { prisma } from "@/lib/db/client";
import { generateOtpCode, sha256Hex } from "@/lib/security/tokens";
import { mockOtpAdapter } from "@/lib/otp/mock-adapter";
import { createAuthenticaOtpAdapter } from "@/lib/otp/authentica-adapter";
import { OtpDeliveryError, type OtpAdapter } from "@/lib/otp/adapter";
import { OtpPurpose } from "@/generated/prisma/client";
import { isTestBypassPhone, isTestPhoneBypassEnabled } from "@/lib/settings/service";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Stored in `codeHash` when the PROVIDER generated the code, so this codebase
 * holds no copy of it. Deliberately not 64 hex characters: `sha256Hex` can
 * never produce it, so a local comparison against it can never accidentally
 * pass — if some future edit forgets to branch, it fails closed.
 */
const PROVIDER_OWNED_CODE = "provider-owned";
const MAX_ATTEMPTS = 5;
const SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_PER_WINDOW = 3;

/**
 * Who delivers the code, and to whom.
 *
 * The mock returns the code to the caller so the screen can show it, which is
 * what makes local work possible and what made an unconfigured production an
 * open door: for months, anyone could type any phone number and read the code
 * off the page. So a built deployment REFUSES to fall back to it. Sending
 * fails loudly and nobody signs in, which is the correct failure — the
 * alternative is everybody signing in as anybody.
 *
 * That covers preview deployments too, without the API key needing to be
 * configured for them: a preview reads the same production database, so a
 * preview that printed codes would be the same hole through a quieter door.
 *
 * One narrow exception survives: the two test numbers, and only while an admin
 * has switched them on from the panel. They are ordinary customer accounts, so
 * the bypass can never reach the admin panel.
 */
async function getAdapter(phone: string): Promise<OtpAdapter> {
  const apiKey = process.env.AUTHENTICA_API_KEY;

  if (isTestBypassPhone(phone) && (await isTestPhoneBypassEnabled())) return mockOtpAdapter;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new OtpDeliveryError("OTP delivery is not configured");
    }
    return mockOtpAdapter;
  }
  return createAuthenticaOtpAdapter(apiKey);
}

export class OtpRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many OTP requests. Please wait before trying again.");
  }
}

export async function requestOtp(
  phone: string,
  purpose: OtpPurpose
): Promise<{ devCode?: string }> {
  const windowStart = new Date(Date.now() - SEND_WINDOW_MS);
  const recentCount = await prisma.otpCode.count({
    where: { phone, purpose, createdAt: { gte: windowStart } },
  });

  if (recentCount >= MAX_SENDS_PER_WINDOW) {
    const oldest = await prisma.otpCode.findFirst({
      where: { phone, purpose, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
    });
    const retryAfterMs = oldest
      ? oldest.createdAt.getTime() + SEND_WINDOW_MS - Date.now()
      : SEND_WINDOW_MS;
    throw new OtpRateLimitError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }

  const adapter = await getAdapter(phone);
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // The row is written either way: it is what limits sending, expires the
  // attempt and counts wrong guesses, none of which the provider does for us.
  await prisma.otpCode.create({
    data: {
      phone,
      purpose,
      codeHash: adapter.ownsCode ? PROVIDER_OWNED_CODE : sha256Hex(code),
      expiresAt,
      maxAttempts: MAX_ATTEMPTS,
    },
  });

  return adapter.sendOtp(phone, code);
}

/**
 * Validates a code without consuming it — used when the caller needs to do
 * more work (e.g. collect a name for a brand-new account) before the OTP
 * should be considered "used". Call consumeOtp() once that work succeeds.
 */
export async function peekOtp(
  phone: string,
  purpose: OtpPurpose,
  submittedCode: string
): Promise<{ valid: boolean; otpId?: string }> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.attempts >= record.maxAttempts) return { valid: false };

  // Who decides depends on who made the code. Read from the ROW, not from the
  // adapter alone: a code sent by the mock and checked after the test-number
  // switch was turned off must not be handed to a provider that never sent it.
  const adapter = await getAdapter(phone);
  const matches =
    record.codeHash === PROVIDER_OWNED_CODE
      ? Boolean(adapter.ownsCode && (await adapter.verifyOtp?.(phone, submittedCode.trim())))
      : record.codeHash === sha256Hex(submittedCode);

  if (!matches) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { valid: false };
  }

  return { valid: true, otpId: record.id };
}

export async function consumeOtp(otpId: string): Promise<void> {
  await prisma.otpCode.update({ where: { id: otpId }, data: { consumedAt: new Date() } });
}

export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  submittedCode: string
): Promise<boolean> {
  const { valid, otpId } = await peekOtp(phone, purpose, submittedCode);
  if (!valid || !otpId) return false;
  await consumeOtp(otpId);
  return true;
}
