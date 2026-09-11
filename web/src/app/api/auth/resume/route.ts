import { redirect } from "next/navigation";
import { refreshSessionHint } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/lib/i18n/locales";

export const dynamic = "force-dynamic";

/**
 * Where the login page sends someone who is already signed in.
 *
 * The header on the static pages learns who is signed in from the readable
 * role cookie (`session-hint.ts`), so a session that has no hint — one opened
 * before the hint existed — looks signed out there, and its owner taps «دخول».
 * A page cannot set a cookie, so the login page hands the request to this
 * handler, which re-issues the hint from the real session and sends her home
 * with the header now matching.
 */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = requested && isLocale(requested) ? requested : defaultLocale;
  const user = await refreshSessionHint();
  redirect(user ? `/${locale}` : `/${locale}/login`);
}
