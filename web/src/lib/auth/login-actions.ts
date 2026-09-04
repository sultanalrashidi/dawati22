"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { createSession } from "@/lib/auth/session";
import { requestOtp, peekOtp, consumeOtp, OtpRateLimitError } from "@/lib/otp/service";
import { OtpDeliveryError } from "@/lib/otp/adapter";
import { normalizePhone } from "@/lib/security/phone";
import { OtpPurpose, Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { createPerInvitationOrder, OrderError } from "@/lib/orders/service";
import { claimDraft } from "@/lib/drafts/service";
import { isValidInvitationCount, parseTier } from "@/lib/orders/pricing";

/**
 * A tier the visitor chose on the pricing page before they had an account.
 *
 * It arrives from the client, so it is worth nothing until it is checked: the
 * tier must parse and the count must land on a legal stop. Neither carries a
 * price — the rate is read from PricingRate when the order is written, exactly
 * as it is for a customer who was already signed in.
 */
/**
 * What she chose before signing in. `eventId` names the invitation she already
 * designed — without it there is nothing for the order to activate, which is
 * why it is required rather than optional.
 */
export type PendingOrder = { tier: string; count: number; eventId: string };

export type OtpRequestResult =
  | { ok: true; devCode?: string; phone: string }
  | {
      ok: false;
      error: "invalid_phone" | "rate_limited" | "delivery";
      retryAfterSeconds?: number;
    };

export async function requestLoginOtpAction(
  rawPhone: string,
  iso: string,
): Promise<OtpRequestResult> {
  const phone = normalizePhone(rawPhone, iso);
  if (!phone) return { ok: false, error: "invalid_phone" };

  // Admins do not sign in here — but this page must not SAY so. It used to
  // answer "this account signs in from the admin page", which handed anyone
  // probing phone numbers a confirmed list of admin accounts. Now an admin
  // number gets the same answer as any other: "code sent". Nothing is sent,
  // no OtpCode row is written, and whatever code gets typed fails as a plain
  // wrong code — the illusion the private route has always kept.
  //
  // The pause stands in for the SMS round-trip the real path pays; without it
  // the instant answer would be its own tell. Known, accepted residue: a
  // pretend-send never rate-limits, where a real number eventually would.
  const user = await prisma.user.findUnique({ where: { phone }, select: { role: true } });
  if (user?.role === Role.ADMIN) {
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600));
    return { ok: true, phone };
  }

  try {
    const { devCode } = await requestOtp(phone, OtpPurpose.LOGIN);
    return { ok: true, devCode, phone };
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return { ok: false, error: "rate_limited", retryAfterSeconds: err.retryAfterSeconds };
    }
    // A deployment with no SMS provider configured refuses to fall back to
    // showing codes on screen, so sending fails. Say so plainly rather than
    // crashing into an error page.
    if (err instanceof OtpDeliveryError) return { ok: false, error: "delivery" };
    throw err;
  }
}

function roleHome(locale: string, role: Role): string {
  if (role === Role.ADMIN) return `/${locale}/admin`;
  if (role === Role.GATE_STAFF) return `/${locale}/gate`;
  return `/${locale}/events`;
}

/**
 * Turns a pre-login tier choice into a real order, and answers with where to
 * send the customer. Returns null when there is nothing to resume or the
 * choice does not survive validation, in which case sign-in ends where it
 * always did.
 */
async function resumePendingOrder(
  userId: string,
  role: Role,
  locale: string,
  pending: PendingOrder,
): Promise<string | null> {
  if (role !== Role.CUSTOMER) return null;

  const tier = parseTier(pending.tier);
  const count = Number(pending.count);
  if (!tier || !isValidInvitationCount(count)) return null;

  // She designed this draft while signed out, so it is still ownerless and
  // the browser is carrying its cookie. Claim it before raising the order:
  // createPerInvitationOrder refuses a draft that is not hers, and rightly so.
  await claimDraft(pending.eventId);

  try {
    const order = await createPerInvitationOrder(userId, {
      tier,
      count,
      draftEventId: pending.eventId,
    });
    return `/${locale}/checkout/${order.id}`;
  } catch (err) {
    // The account exists and the session is live either way; only the order
    // failed. Send her back to her own invitation rather than to pricing —
    // the draft is the thing she was in the middle of, and it is still there.
    if (err instanceof OrderError) return `/${locale}/draft/${pending.eventId}/activate?error=1`;
    throw err;
  }
}

async function startSession(
  userId: string,
  role: Role,
  locale: string,
  pending?: PendingOrder | null,
) {
  const hdrs = await headers();
  await createSession(userId, {
    userAgent: hdrs.get("user-agent") ?? undefined,
    ip: hdrs.get("x-forwarded-for") ?? undefined,
  });
  if (pending) {
    const checkout = await resumePendingOrder(userId, role, locale, pending);
    if (checkout) return checkout;
  }
  return roleHome(locale, role);
}

export type OtpSubmitResult =
  | { ok: true; needsName: false; redirectTo: string }
  | { ok: true; needsName: true; otpId: string }
  | { ok: false; error: "invalid_phone" | "invalid_code" | "account_blocked" };

export async function submitOtpCodeAction(
  rawPhone: string,
  iso: string,
  code: string,
  locale: string,
  pending?: PendingOrder | null
): Promise<OtpSubmitResult> {
  const phone = normalizePhone(rawPhone, iso);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const { valid, otpId } = await peekOtp(phone, OtpPurpose.LOGIN, code.trim());
  if (!valid || !otpId) return { ok: false, error: "invalid_code" };

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    return { ok: true, needsName: true, otpId };
  }
  if (user.isBlocked) return { ok: false, error: "account_blocked" };
  // An admin can only reach this line with a REAL code — one the private
  // route sent for their own sign-in, pasted here instead. Still refused (a
  // customer session for an admin must never exist), but as a plain wrong
  // code: naming the real reason would un-hide what the pretend-send above
  // hides.
  if (user.role === Role.ADMIN) return { ok: false, error: "invalid_code" };

  await consumeOtp(otpId);
  if (!user.phoneVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  }
  const redirectTo = await startSession(user.id, user.role, safeLocale, pending);
  return { ok: true, needsName: false, redirectTo };
}

export type CompleteSignupResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "invalid_code" | "name_required" };

export async function completeSignupAction(
  otpId: string,
  rawPhone: string,
  iso: string,
  name: string,
  locale: string,
  pending?: PendingOrder | null
): Promise<CompleteSignupResult> {
  const phone = normalizePhone(rawPhone, iso);
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

  const redirectTo = await startSession(user.id, user.role, safeLocale, pending);
  return { ok: true, redirectTo };
}
