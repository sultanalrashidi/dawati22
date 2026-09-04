import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { InvitationTier, Role } from "@/generated/prisma/client";
import { listPricingRates } from "@/lib/orders/service";
import { couplesFor } from "@/lib/events/service";
import { resolveDraftAccess } from "@/lib/drafts/service";
import { ActivatePicker } from "@/components/drafts/activate-picker";

/**
 * Steps five and six of the customer's journey: how many invitations and
 * whether they carry a door code, then sign in and pay.
 *
 * The whole pre-payment stretch runs signed out, which is why this page lives
 * under /draft rather than /events — everything under /events requires a
 * session. The same URL therefore serves her before and after signing in,
 * which is what lets it be the place login sends her back to.
 */
export default async function ActivateDraftPage({
  params,
  searchParams,
}: PageProps<"/[locale]/draft/[eventId]/activate">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const d = dict.draft;

  const draft = await resolveDraftAccess(eventId);
  // resolveDraftAccess only ever returns UNPAID drafts, so a draft that has
  // been activated in the meantime (she paid in another tab) lands on its
  // dashboard rather than being offered for sale a second time.
  if (!draft) redirect(`/${locale}/events/${eventId}`);

  const [user, rates] = await Promise.all([getSessionUser(), listPricingRates()]);
  const withQr = rates.find((r) => r.tier === InvitationTier.WITH_QR);
  const noQr = rates.find((r) => r.tier === InvitationTier.NO_QR);
  if (!withQr || !noQr) redirect(`/${locale}/plans`);

  const [couple] = couplesFor(draft);
  const dateText = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(draft.eventDate);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <div>
        <p className="text-sm font-bold text-accent">{d.activateStep}</p>
        <h1 className="mt-1 text-2xl font-bold text-fg">{d.activateTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.activateSubtitle}</p>
      </div>

      {/* What she is about to pay for, in her own words — not an order number. */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-bold text-fg-muted">{d.activateDraftLabel}</p>
        <p className="mt-1 text-base font-bold text-fg">
          {couple.groomNameAr || couple.groomNameEn} {d.and} {couple.brideNameAr || couple.brideNameEn}
        </p>
        <p className="mt-0.5 text-sm text-fg-muted">
          {dateText} · {draft.locationName}
        </p>
        <Link
          href={`/preview/${eventId}`}
          className="mt-3 inline-block text-sm font-bold text-accent hover:underline"
        >
          {d.activateSeePreview}
        </Link>
      </div>

      {search.error === "1" && (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-fg">
          {d.activateError}
        </p>
      )}

      <ActivatePicker
        locale={locale}
        dict={dict}
        eventId={eventId}
        signedIn={user?.role === Role.CUSTOMER}
        rates={{
          withQr: { tier: "WITH_QR", unitPrice: Number(withQr.unitPrice) },
          noQr: { tier: "NO_QR", unitPrice: Number(noQr.unitPrice) },
        }}
        // Pre-filled with what she picked on the pricing page, when she came
        // that way — the whole reason that choice was carried this far.
        initialTier={draft.intendedTier === InvitationTier.NO_QR ? "NO_QR" : "WITH_QR"}
        initialCount={draft.intendedCount ?? 0}
      />

      <p className="text-xs leading-relaxed text-fg-muted">{d.activateWatermarkNote}</p>
    </div>
  );
}
