import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { verifyMoyasarWebhookSecret } from "@/lib/payments/moyasar";
import { applyMoyasarWebhookEvent } from "@/lib/orders/service";

interface MoyasarWebhookPayload {
  secret_token?: string;
  type?: string;
  data?: { id?: string; metadata?: { order_id?: string } | null };
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as MoyasarWebhookPayload;

  if (!verifyMoyasarWebhookSecret(payload.secret_token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const paymentId = payload.data?.id;
  const orderId = payload.data?.metadata?.order_id;
  const type = payload.type;

  if (!paymentId || !type) {
    return NextResponse.json({ ok: true });
  }

  try {
    await applyMoyasarWebhookEvent(type, paymentId, orderId);
  } catch (err) {
    logger.error("webhooks.moyasar.processing_failed", {
      paymentId,
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Still 200 — Moyasar retries on non-2xx and we've already logged for investigation.
  }

  return NextResponse.json({ ok: true });
}
