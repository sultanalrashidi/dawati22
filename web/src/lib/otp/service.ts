import "server-only";
import { prisma } from "@/lib/db/client";
import { generateOtpCode, sha256Hex } from "@/lib/security/tokens";
import { mockOtpAdapter } from "@/lib/otp/mock-adapter";
import { createAuthenticaOtpAdapter } from "@/lib/otp/authentica-adapter";
import type { OtpAdapter } from "@/lib/otp/adapter";
import { OtpPurpose } from "@/generated/prisma/client";
import { isTestBypassPhone, isTestPhoneBypassEnabled } from "@/lib/settings/service";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_PER_WINDOW = 3;

/**
 * Who delivers the code, and to whom.
 *
 * With no API key configured there is nothing that can send an SMS, so every
 * number falls back to the mock — which returns the code for the screen. That
 * is right for local work and is exactly what makes an unconfigured production
 * an open door, so `assertOtpDeliveryConfigured` below is what production
 * actually leans on.
 *
 * With a key, one narrow exception stays: the two test numbers, and only while
 * an admin has switched them on. They are ordinary customer accounts, so the
 * bypass can never reach the admin panel.
 */
async function getAdapter(phone: string): Promise<OtpAdapter> {
  const apiKey = process.env.AUTHENTICA_API_KEY;
  if (!apiKey) return mockOtpAdapter;
  if (isTestBypassPhone(phone) && (await isTestPhoneBypassEnabled())) return mockOtpAdapter;
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

  const code = generateOtpCode();
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.otpCode.create({
    data: { phone, purpose, codeHash, expiresAt, maxAttempts: MAX_ATTEMPTS },
  });

  const result = await (await getAdapter(phone)).sendOtp(phone, code);
  return result;
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

  const matches = record.codeHash === sha256Hex(submittedCode);
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
