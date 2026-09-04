import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { isValidInvitationCount, parseTier } from "@/lib/orders/pricing";
import { InvitationTier } from "@/generated/prisma/enums";

/**
 * Sign-in, and — when the visitor got here by choosing a tier on the pricing
 * page — the second half of that purchase.
 *
 * The choice travels in the URL rather than a cookie so it belongs to exactly
 * one journey: someone who opens this page on their own gets the ordinary path
 * to their events, and an abandoned choice can never resurface on a later
 * sign-in. Nothing in the query is trusted — the tier and the count are
 * re-validated here and again in the action, and the rate is read from the
 * database, which is the same deal the pricing form itself gets.
 */
export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getSessionUser();
  if (user) redirect(`/${locale}`);

  const search = await searchParams;
  const dict = await getDictionary(locale);

  const tier = search?.next === "order" ? parseTier(search.tier) : null;
  const count = Number(search?.count);
  // The invitation this sign-in is on the way to paying for. Without it there
  // is nothing to activate, so the whole pending order is dropped rather than
  // carried half-formed — she lands on her events page and finds the draft
  // waiting under «دعوات غير مكتملة».
  const eventId = typeof search?.event === "string" ? search.event : "";
  const pendingOrder =
    tier && eventId && isValidInvitationCount(count) ? { tier, count, eventId } : null;

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-fg">{dict.auth.loginTitle}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.auth.loginSubtitle}</p>
      </div>

      {pendingOrder && (
        <div className="rounded-2xl border border-accent-soft/60 bg-accent-soft/15 px-5 py-4 text-center">
          <p className="text-sm text-fg-muted">{dict.auth.pendingOrderLead}</p>
          <p className="mt-1 text-base font-bold text-fg">
            {nf.format(pendingOrder.count)} {dict.plans.countUnit} —{" "}
            {pendingOrder.tier === InvitationTier.WITH_QR
              ? dict.plans.tierQrShort
              : dict.plans.tierNoQrShort}
          </p>
        </div>
      )}

      <LoginForm locale={locale} dict={dict} pendingOrder={pendingOrder} />
    </div>
  );
}
