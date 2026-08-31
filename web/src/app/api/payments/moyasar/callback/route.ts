import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { fetchMoyasarPayment } from "@/lib/payments/moyasar";
import { confirmMoyasarPayment, paidOrderDestination, OrderError } from "@/lib/orders/service";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

// Moyasar redirects the browser here after a hosted-form payment attempt.
// The redirect status is UX-only — payment state is always re-verified server-side.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const paymentId = searchParams.get("id");
  const rawLocale = searchParams.get("locale");
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : defaultLocale;

  if (!paymentId) {
    return NextResponse.redirect(new URL(`/${locale}/plans`, request.url));
  }

  // Normally ours, straight off the callback_url the form was built with.
  let orderId = searchParams.get("orderId");
  if (!orderId) {
    // A card has been charged by the time we get here, so a redirect that
    // arrives without our own parameters must not strand the customer on the
    // pricing page: the payment itself names the order it belongs to.
    try {
      orderId = (await fetchMoyasarPayment(paymentId)).metadata?.order_id ?? null;
    } catch {
      orderId = null;
    }
    if (!orderId) {
      return NextResponse.redirect(new URL(`/${locale}/plans`, request.url));
    }
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  try {
    await confirmMoyasarPayment(orderId, user.id, paymentId);
    // Not always the events list: a paid design fee belongs on the event the
    // design just landed on.
    return NextResponse.redirect(new URL(await paidOrderDestination(orderId, locale), request.url));
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.redirect(new URL(`/${locale}/checkout/${orderId}?error=1`, request.url));
    }
    throw err;
  }
}
