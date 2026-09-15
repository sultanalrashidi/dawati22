import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { listEligibleOrders } from "@/lib/events/service";
import { buildThemeOptions } from "@/lib/events/theme-options";
import { orderSummaryLabel } from "@/lib/orders/terms";
import { createEventAction } from "@/lib/events/actions";
import { Role } from "@/generated/prisma/client";
import { EventFields } from "@/components/events/event-fields";
import { EventTypeGate } from "@/components/events/event-type-gate";
import { ConfirmSubmit } from "@/components/events/confirm-submit";
import { riyadhDateFormat } from "@/lib/dates";

/**
 * The OLD pay-first creation form, kept only as a fulfilment path.
 *
 * It is no longer an entrance to anything: the journey now starts free in the
 * gallery, and the route redirects anyone without an eligible order there.
 * What it cannot be is deleted — `listEligibleOrders` finds orders that are
 * PAID with no event, which is what a legacy pay-first purchase looks like and
 * what a payment that landed on an already-claimed draft looks like. This form
 * is the only thing that turns one of those into an invitation, so removing it
 * would strand somebody who has already been charged.
 */
export default async function NewEventPage({
  params,
  searchParams,
}: PageProps<"/[locale]/events/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const [eligibleOrders, themeOptions] = await Promise.all([
    listEligibleOrders(user.id),
    buildThemeOptions(locale, user.id),
  ]);

  if (eligibleOrders.length === 0) redirect(`/${locale}/themes`);

  const preselectedOrderId =
    typeof search?.orderId === "string" && eligibleOrders.some((o) => o.id === search.orderId)
      ? search.orderId
      : eligibleOrders[0].id;

  const boundCreateEvent = createEventAction.bind(null, locale);
  const f = dict.events.form;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold text-fg">{dict.events.newTitle}</h1>

      {/* The event is written once and the customer has no edit screen, so the
          warning belongs before the fields — not next to the button they press
          after they have already typed everything. */}
      <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-4">
        <p className="text-sm font-semibold text-fg">{f.reviewNoticeTitle}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{f.reviewNoticeBody}</p>
      </div>

      {search?.error && (
        <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{dict.common.error}</p>
      )}

      <form action={boundCreateEvent} className="mt-8 flex flex-col gap-6">
        {eligibleOrders.length > 1 ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{f.orderLabel}</span>
            <select
              name="orderId"
              defaultValue={preselectedOrderId}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            >
              {eligibleOrders.map((order) => (
                // The purchase date is what tells two same-sized orders apart —
                // without it a customer with two 300-invitation orders is picking
                // blind, and the wrong pick is not undoable.
                <option key={order.id} value={order.id}>
                  {orderSummaryLabel(order, locale, dict)} —{" "}
                  {riyadhDateFormat(locale === "ar" ? "ar-SA" : "en-US").format(new Date(order.createdAt))}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="orderId" value={preselectedOrderId} />
        )}

        {/* Everything past the type select is wedding-shaped — groom and bride
            names, wedding artwork, wedding copy. Picking another occasion
            replaces all of it with "not yet" rather than letting someone fill
            in a form the product cannot deliver on. */}
        <EventTypeGate dict={dict}>
          {/* Everything inside the gate is a wedding, and a wedding is named
              after its couple — see eventNameFor. */}
          <EventFields locale={locale} dict={dict} themeOptions={themeOptions} hideName />

          <ConfirmSubmit
            label={f.confirmAccuracyLabel}
            hint={f.confirmAccuracyHint}
            submitLabel={f.submit}
          />
        </EventTypeGate>
      </form>
    </div>
  );
}
