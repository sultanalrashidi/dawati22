import { logger } from "@/lib/logger";

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
