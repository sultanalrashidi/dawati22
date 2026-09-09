import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { getOwnedEvent } from "@/lib/events/service";
import { orderTerms } from "@/lib/orders/terms";
import { riyadhDateFormat } from "@/lib/dates";

/**
 * «تم الدفع وتفعيل دعوتك» — the customer's own words for step seven.
 *
 * Confirm the purchase and make the next action visible before the receipt,
 * especially on a phone where the receipt can fill the first screen. The
 * order is fixed: adding guests first, because it is the one step between
 * paying and sending that cannot be skipped; editing second, and only while
 * `detailsLockedAt` is null; the watermark-free preview last, as a link.
 */
export default async function ActivatedPage({
  params,
  searchParams,
}: PageProps<"/[locale]/events/[eventId]/activated">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const d = dict.draft;

  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);
  // getOwnedEvent only returns ACTIVATED events, so reaching this page at all
  // is the proof that activation actually happened — there is no way to show a
  // success screen for a payment that did not land.
  const event = await getOwnedEvent(eventId, user.id);
  if (!event) notFound();

  const terms = orderTerms(event.order);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const paidAt = event.order?.paidAt ?? null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      {/* The same words in the same place on every screen that hangs off her
          event page, so "how do I get back" never needs asking. */}
      <Link
        href={`/${locale}/events/${eventId}`}
        className="self-start text-sm font-bold text-accent hover:underline"
      >
        {dict.events.detail.backToEvent}
      </Link>

      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-2xl text-success"
        >
          ✓
        </span>
        <h1 className="mt-4 text-2xl font-bold text-fg">{d.activatedTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.activatedSubtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-center text-sm leading-relaxed text-fg-muted">{d.activatedNextHint}</p>
        <Link
          href={`/${locale}/events/${eventId}#add-guests`}
          className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {d.activatedAddGuests}
        </Link>
        {/* The details stay open until the first invitation actually goes
            out — detailsLockedAt, not payment, is the freeze. Once locked the
            button goes, rather than leading to a panel that says no. */}
        {event.detailsLockedAt === null && (
          <Link
            href={`/${locale}/events/${eventId}/details`}
            className="flex h-12 items-center justify-center rounded-full border border-border text-sm font-bold text-fg transition-colors hover:border-accent"
          >
            {d.activatedEditInvitation}
          </Link>
        )}
        <Link
          href={`/preview/${eventId}`}
          className="flex min-h-11 items-center justify-center text-sm font-bold text-accent hover:underline"
        >
          {d.activatedSeeInvitation}
        </Link>
      </div>

      <dl className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-5">
        <Row label={d.receiptEvent} value={event.name} />
        <Row label={d.receiptCount} value={`${nf.format(terms.invitationCount)} ${dict.plans.countUnit}`} />
        <Row label={d.receiptTier} value={terms.hasQr ? dict.plans.tierQr : dict.plans.tierNoQr} />
        <Row
          label={d.receiptAmount}
          value={`${nf.format(terms.total)} ${dict.common.sar}`}
        />
        {paidAt && (
          <Row
            label={d.receiptDate}
            value={riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(paidAt)}
          />
        )}
        {typeof search.order === "string" && <Row label={d.receiptRef} value={search.order} mono />}
      </dl>

    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={`text-sm font-bold text-fg ${mono ? "font-mono text-xs" : "tabular-nums"}`} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
