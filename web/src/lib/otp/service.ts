import "server-only";
import { prisma } from "@/lib/db/client";
import { timingSafeEqual } from "node:crypto";
import { generateOtpCode, generateSecureToken, sha256Hex } from "@/lib/security/tokens";
import { lockKey } from "@/lib/db/lock";
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
/**
 * Stored in `codeHash` for a request that was recorded but deliberately not
 * delivered (see `RequestOtpOptions.deliver`). Like PROVIDER_OWNED_CODE it is
 * not a sha256 hex string, so no submitted code can ever match it.
 */
const UNDELIVERED_CODE = "not-delivered";
const MAX_ATTEMPTS = 5;
const SIGNUP_GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes to type a name
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

export interface RequestOtpOptions {
  /**
   * False records the request exactly as a real send would — same adapter
   * check, same shared send ledger, same rate limit — but delivers nothing and
   * stores a challenge no code can satisfy. For numbers the public page must
   * not reveal (admin accounts): the caller cannot tell the two apart by
   * response, rate limiting or delivery errors.
   */
  deliver?: boolean;
}

/**
 * Admits one send against the per-phone, per-purpose budget, then delivers.
 *
 * Admission is count-then-insert under a Postgres advisory lock on the phone
 * and purpose, so concurrent requests queue behind each other instead of all
 * counting the same empty ledger and all sending. The SMS call happens after
 * the lock is released.
 *
 * Failure semantics: a send the provider rejects still spends its slot. The
 * row is reserved before the side effect on purpose — refunding on failure
 * would let a caller hammer a failing provider without limit. The adapter is
 * resolved BEFORE admission, so an unconfigured deployment refuses without
 * spending anyone's budget.
 */
export async function requestOtp(
  phone: string,
  purpose: OtpPurpose,
  options: RequestOtpOptions = {},
): Promise<{ devCode?: string }> {
  const deliver = options.deliver ?? true;
  const adapter = await getAdapter(phone);
  const code = generateOtpCode();

  await prisma.$transaction(async (tx) => {
    await lockKey(tx, "otp-send", `${purpose}:${phone}`);

    const windowStart = new Date(Date.now() - SEND_WINDOW_MS);
    const recent = await tx.otpCode.findMany({
      where: { phone, purpose, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      take: MAX_SENDS_PER_WINDOW,
    });
    if (recent.length >= MAX_SENDS_PER_WINDOW) {
      const retryAfterMs = recent[0].createdAt.getTime() + SEND_WINDOW_MS - Date.now();
      throw new OtpRateLimitError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
    }

    // The row is written either way: it is what limits sending, expires the
    // attempt and counts wrong guesses, none of which the provider does for us.
    await tx.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: !deliver ? UNDELIVERED_CODE : adapter.ownsCode ? PROVIDER_OWNED_CODE : sha256Hex(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        maxAttempts: MAX_ATTEMPTS,
      },
    });
  });

  if (!deliver) return {};
  return adapter.sendOtp(phone, code);
}

export type OtpCheckResult = { valid: false } | { valid: true; otpId: string };

/**
 * Checks a code and, when it is right, spends the challenge — one atomic
 * security transition per step, in this order:
 *
 *  1. CLAIM an attempt on the phone's current challenge (the newest one for
 *     this purpose; an older challenge is superseded the moment a newer one is
 *     sent). The claim is a single conditional UPDATE, so no more than
 *     `maxAttempts` checks can ever be admitted, however many arrive at once —
 *     correct guesses count too, and a claimed attempt is never refunded,
 *     whatever the provider answers.
 *  2. COMPARE, outside any lock: locally for our own hash, or by asking the
 *     provider for a code it generated.
 *  3. CONSUME with a second conditional UPDATE. Only one caller can move
 *     `consumedAt` from null, so two right answers in parallel yield one
 *     success, not two sessions.
 */
export async function checkAndConsumeOtp(
  phone: string,
  purpose: OtpPurpose,
  submittedCode: string,
): Promise<OtpCheckResult> {
  const [claimed] = await prisma.$queryRaw<{ id: string; codeHash: string }[]>`
    UPDATE "OtpCode"
       SET "attempts" = "attempts" + 1
     WHERE "id" = (
             SELECT "id" FROM "OtpCode"
              WHERE "phone" = ${phone} AND "purpose" = ${purpose}::"OtpPurpose"
              ORDER BY "createdAt" DESC, "id" DESC
              LIMIT 1
           )
       AND "consumedAt" IS NULL
       AND "expiresAt" > NOW()
       AND "attempts" < "maxAttempts"
    RETURNING "id", "codeHash"
  `;
  if (!claimed) return { valid: false };

  // Who decides depends on who made the code. Read from the ROW, not from the
  // adapter alone: a code sent by the mock and checked after the test-number
  // switch was turned off must not be handed to a provider that never sent it.
  const code = submittedCode.trim();
  let matches: boolean;
  if (claimed.codeHash === PROVIDER_OWNED_CODE) {
    const adapter = await getAdapter(phone);
    matches = Boolean(adapter.ownsCode && (await adapter.verifyOtp?.(phone, code)));
  } else {
    matches = safeEqual(claimed.codeHash, sha256Hex(code));
  }
  if (!matches) return { valid: false };

  // Still unconsumed, unexpired and not superseded by a newer send while the
  // provider was answering.
  const [consumed] = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "OtpCode" AS o
       SET "consumedAt" = NOW()
     WHERE o."id" = ${claimed.id}
       AND o."consumedAt" IS NULL
       AND o."expiresAt" > NOW()
       AND NOT EXISTS (
             SELECT 1 FROM "OtpCode" n
              WHERE n."phone" = o."phone" AND n."purpose" = o."purpose" AND n."createdAt" > o."createdAt"
           )
    RETURNING o."id"
  `;
  return consumed ? { valid: true, otpId: consumed.id } : { valid: false };
}

export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  submittedCode: string
): Promise<boolean> {
  return (await checkAndConsumeOtp(phone, purpose, submittedCode)).valid;
}

/**
 * A short-lived, single-use pass for the step after a verified code: naming a
 * brand-new account. The code itself is already spent by then — the provider
 * cannot be asked about it twice — so what the name step presents is this
 * grant, bound server-side to the phone and purpose it was issued for. Only
 * its sha256 is stored; the raw value lives in the client's form state.
 */
export async function issueSignupGrant(otpId: string): Promise<string> {
  const grant = generateSecureToken();
  await prisma.otpCode.update({
    where: { id: otpId },
    data: {
      signupGrantHash: sha256Hex(grant),
      signupGrantExpiresAt: new Date(Date.now() + SIGNUP_GRANT_TTL_MS),
    },
  });
  return grant;
}

/** Spends a signup grant for this phone. True for exactly one caller. */
export async function consumeSignupGrant(grant: string, phone: string, purpose: OtpPurpose): Promise<boolean> {
  if (!grant) return false;
  const [row] = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "OtpCode"
       SET "signupGrantUsedAt" = NOW()
     WHERE "signupGrantHash" = ${sha256Hex(grant)}
       AND "phone" = ${phone}
       AND "purpose" = ${purpose}::"OtpPurpose"
       AND "signupGrantUsedAt" IS NULL
       AND "signupGrantExpiresAt" > NOW()
    RETURNING "id"
  `;
  return Boolean(row);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
