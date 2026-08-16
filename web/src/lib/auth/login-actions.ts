"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { createSession } from "@/lib/auth/session";
import { requestOtp, peekOtp, consumeOtp, OtpRateLimitError } from "@/lib/otp/service";
import { normalizeSaudiPhone } from "@/lib/security/phone";
import { OtpPurpose, Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

export type OtpRequestResult =
  | { ok: true; devCode?: string; phone: string }
  | { ok: false; error: "invalid_phone" | "rate_limited"; retryAfterSeconds?: number };

export async function requestLoginOtpAction(rawPhone: string): Promise<OtpRequestResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  try {
    const { devCode } = await requestOtp(phone, OtpPurpose.LOGIN);
    return { ok: true, devCode, phone };
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return { ok: false, error: "rate_limited", retryAfterSeconds: err.retryAfterSeconds };
    }
    throw err;
  }
}

function roleHome(locale: string, role: Role): string {
  if (role === Role.ADMIN) return `/${locale}/admin`;
  if (role === Role.GATE_STAFF) return `/${locale}/gate`;
  return `/${locale}/events`;
}

async function startSession(userId: string, role: Role, locale: string) {
  const hdrs = await headers();
  await createSession(userId, {
    userAgent: hdrs.get("user-agent") ?? undefined,
    ip: hdrs.get("x-forwarded-for") ?? undefined,
  });
  return roleHome(locale, role);
}

export type OtpSubmitResult =
  | { ok: true; needsName: false; redirectTo: string }
  | { ok: true; needsName: true; otpId: string }
  | { ok: false; error: "invalid_phone" | "invalid_code" | "account_blocked" };

export async function submitOtpCodeAction(
  rawPhone: string,
  code: string,
  locale: string
): Promise<OtpSubmitResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const { valid, otpId } = await peekOtp(phone, OtpPurpose.LOGIN, code.trim());
  if (!valid || !otpId) return { ok: false, error: "invalid_code" };

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    return { ok: true, needsName: true, otpId };
  }
  if (user.isBlocked) return { ok: false, error: "account_blocked" };

  await consumeOtp(otpId);
  if (!user.phoneVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  }
  const redirectTo = await startSession(user.id, user.role, safeLocale);
  return { ok: true, needsName: false, redirectTo };
}

export type CompleteSignupResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "invalid_code" | "name_required" };

export async function completeSignupAction(
  otpId: string,
  rawPhone: string,
  name: string,
  locale: string
): Promise<CompleteSignupResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  const trimmedName = name.trim();
  if (trimmedName.length < 2) return { ok: false, error: "name_required" };
  if (!phone) return { ok: false, error: "invalid_code" };

  const record = await prisma.otpCode.findUnique({ where: { id: otpId } });
  if (
    !record ||
    record.phone !== phone ||
    record.purpose !== OtpPurpose.LOGIN ||
    record.consumedAt ||
    record.expiresAt < new Date()
  ) {
    return { ok: false, error: "invalid_code" };
  }

  await consumeOtp(otpId);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: {
      phone,
      name: trimmedName,
      role: Role.CUSTOMER,
      phoneVerifiedAt: new Date(),
      locale: safeLocale === "ar" ? "ar" : "en",
    },
  });

  const redirectTo = await startSession(user.id, user.role, safeLocale);
  return { ok: true, redirectTo };
}
