import "server-only";
import { logger } from "@/lib/logger";
import { getAppUrl } from "@/lib/urls";

const BASE_URL = "https://api.moyasar.com/v1";

export function isMoyasarConfigured(): boolean {
  return Boolean(process.env.MOYASAR_SECRET_KEY && process.env.MOYASAR_PUBLISHABLE_KEY);
}

interface MoyasarPayment {
  id: string;
  status: "initiated" | "paid" | "failed" | "authorized" | "captured" | "refunded" | "voided";
  amount: number;
  currency: string;
  metadata: Record<string, string> | null;
  source?: { message?: string; response_code?: string };
}

function authHeader(): string {
  const secretKey = process.env.MOYASAR_SECRET_KEY;
  if (!secretKey) throw new Error("MOYASAR_SECRET_KEY is not configured");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

/** Server-side verification — never trust the client-side redirect status alone. */
export async function fetchMoyasarPayment(paymentId: string): Promise<MoyasarPayment> {
  const response = await fetch(`${BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader() },
  });

  if (!response.ok) {
    logger.error("payments.moyasar.fetch_failed", { paymentId, status: response.status });
    throw new Error(`Failed to fetch Moyasar payment ${paymentId}`);
  }

  return (await response.json()) as MoyasarPayment;
}

export function verifyMoyasarWebhookSecret(secretToken: string | undefined): boolean {
  const expected = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!expected || !secretToken) return false;
  // Fixed-length comparison isn't critical here (not a crypto signature, just a
  // shared secret string) but constant-time avoids trivial timing leaks.
  if (secretToken.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= secretToken.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function sarToHalalas(amountSar: number): number {
  return Math.round(amountSar * 100);
}

/**
 * Everything the hosted payment form needs, decided on the server.
 *
 * It lives beside `fetchMoyasarPayment` on purpose: this object and the
 * verification in `confirmMoyasarPayment` are two halves of one contract, and
 * the halves have to agree on all three of the things that are checked — the
 * amount in halalas, the currency, and `metadata.order_id`. Split across two
 * files they drift, and the failure mode is a customer whose card is charged
 * for an order our own verification then refuses to settle.
 *
 * The price is converted here rather than in the browser for the same reason
 * the total is computed server-side in `createPerInvitationOrder`: the client
 * picks WHAT to pay for, never what it costs. A tampered amount does not get
 * anywhere either way — verification compares against the stored order — but
 * it fails as a declined order instead of a wrong charge.
 */
// NOTE: keep this label ASCII. It is not only shown in the sheet — Moyasar
// sends it to Apple as the merchant-session `display_name` during merchant
// validation, and an Arabic value there makes that validation fail: the Apple
// Pay sheet shows the cards, then aborts before a payment is ever created.
// Verified the hard way on 2026-08-31 — "دعوتي" broke it, "Dawati" fixed it.
// The store is still دعوتي everywhere the customer actually reads a name.

/**
 * Apple Pay's hosted-form block. All three fields are REQUIRED by Moyasar's
 * form the moment `applepay` is listed as a method — a missing one throws
 * during init and takes the whole card form down with it, on every device.
 * So this is built here, always complete, rather than assembled in the browser.
 *
 * `validateMerchantUrl` is Moyasar's own endpoint: the form POSTs the Apple
 * session to it so we never handle the Apple Pay merchant certificate
 * ourselves. `label` is the store name Apple shows in the payment sheet.
 */
export interface ApplePayConfig {
  country: string;
  label: string;
  validateMerchantUrl: string;
}

export interface MoyasarFormConfig {
  publishableApiKey: string;
  /** Halalas. Moyasar accepts no other unit, and 1 SAR = 100. */
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  metadata: { order_id: string };
  /** Null until the Apple Pay domain is verified — see moyasarFormConfig. */
  applePay: ApplePayConfig | null;
}

/** The store name Apple shows in the payment sheet ("Pay <label>"). */
const APPLE_PAY_LABEL = "Dawati";
/** Moyasar's own merchant-validation endpoint — see ApplePayConfig. */
const APPLE_PAY_VALIDATE_URL = "https://api.moyasar.com/v1/applepay/initiate";

/**
 * Apple Pay is offered only when it is switched ON by env, because the button
 * cannot work until the domain is verified with Apple. Left off, the field is
 * null and the form ships card-only exactly as before — flipping the flag is
 * the whole rollout, with no code change and no redeploy of the form itself.
 */
function applePayConfig(): ApplePayConfig | null {
  if (process.env.MOYASAR_APPLE_PAY !== "on") return null;
  return {
    country: "SA",
    label: APPLE_PAY_LABEL,
    validateMerchantUrl: APPLE_PAY_VALIDATE_URL,
  };
}

export function moyasarFormConfig(input: {
  orderId: string;
  amountSar: number;
  currency: string;
  description: string;
  locale: string;
}): MoyasarFormConfig {
  const publishableApiKey = process.env.MOYASAR_PUBLISHABLE_KEY;
  if (!publishableApiKey) throw new Error("MOYASAR_PUBLISHABLE_KEY is not configured");

  // Absolute, because Moyasar redirects the browser to it from its own domain.
  const callbackUrl = new URL("/api/payments/moyasar/callback", getAppUrl());
  // Which order came back, and in which language to greet them. Both are
  // conveniences: the callback re-derives the order from the payment's own
  // metadata if a redirect ever arrives without them.
  callbackUrl.searchParams.set("orderId", input.orderId);
  callbackUrl.searchParams.set("locale", input.locale);

  return {
    publishableApiKey,
    amount: sarToHalalas(input.amountSar),
    currency: input.currency,
    description: input.description,
    callbackUrl: callbackUrl.toString(),
    metadata: { order_id: input.orderId },
    applePay: applePayConfig(),
  };
}
