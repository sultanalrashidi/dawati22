import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { confirmMoyasarPayment, OrderError } from "@/lib/orders/service";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

// Moyasar redirects the browser here after a hosted-form payment attempt.
// The redirect status is UX-only — payment state is always re-verified server-side.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const paymentId = searchParams.get("id");
  const orderId = searchParams.get("orderId");
  const rawLocale = searchParams.get("locale");
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : defaultLocale;

  if (!paymentId || !orderId) {
    return NextResponse.redirect(new URL(`/${locale}/plans`, request.url));
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  try {
    await confirmMoyasarPayment(orderId, user.id, paymentId);
    return NextResponse.redirect(new URL(`/${locale}/events?purchased=1`, request.url));
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.redirect(new URL(`/${locale}/checkout/${orderId}?error=1`, request.url));
    }
    throw err;
  }
}
