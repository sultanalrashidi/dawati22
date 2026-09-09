import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedOrder, paidOrderDestination } from "@/lib/orders/service";
import { orderSummaryLabel } from "@/lib/orders/terms";
import { isMoyasarConfigured, moyasarFormConfig } from "@/lib/payments/moyasar";
import { confirmMockPaymentAction } from "@/lib/orders/actions";
import { MoyasarForm } from "@/components/checkout/moyasar-form";
import { OrderStatus, Role } from "@/generated/prisma/client";
import { supportWhatsAppUrl } from "@/lib/support";

/**
 * Only a PENDING order may be paid.
 *
 * `confirmMoyasarPayment` enforces the same rule server-side, but by the time
 * it runs Moyasar has already taken the card: a page that offers a live card
 * form for a FAILED or superseded order is a page that charges a customer for
 * something that can never be activated. So the form is gated on the one
 * status that can still settle, and every other status gets told where its
 * money is and where to go next.
 */
function isPayable(status: OrderStatus): boolean {
  return status === OrderStatus.PENDING;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/[locale]/checkout/[orderId]">) {
  const { locale, orderId } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const order = await getOwnedOrder(orderId, user.id);
  if (!order) notFound();
  // Reopening a paid checkout should resume the invitation, including when
  // the payment webhook finished before the customer returned here.
  if (order.status === OrderStatus.PAID) {
    redirect(await paidOrderDestination(order.id, locale));
  }

  const planName = orderSummaryLabel(order, locale, dict);
  const boundConfirmMock = confirmMockPaymentAction.bind(null, order.id, locale);
  const hasError = search?.error === "1";

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold text-fg">{dict.checkout.title}</h1>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-fg-muted">{dict.checkout.orderSummary}</h2>
        <dl className="mt-4 space-y-2 text-fg">
          <div className="flex justify-between">
            <dt className="text-fg-muted">{dict.checkout.plan}</dt>
            <dd>{planName}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <dt>{dict.checkout.amount}</dt>
            <dd>
              {Number(order.amount).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} {dict.common.sar}
            </dd>
          </div>
        </dl>
      </div>

      {hasError && <p className="mt-4 text-sm text-danger">{dict.checkout.error}</p>}

      {!isPayable(order.status) ? (
        <ClosedOrder locale={locale} order={order} dict={dict} />
      ) : isMoyasarConfigured() ? (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm font-medium text-fg-muted">{dict.checkout.payMoyasar}</h2>
          {/* The order's own stored total is what gets charged and what the
              callback verifies against — the browser is never told a price it
              could send back changed. */}
          <MoyasarForm
            config={moyasarFormConfig({
              orderId: order.id,
              amountSar: Number(order.amount),
              currency: order.currency,
              description: planName,
              locale,
            })}
            unavailableLabel={dict.checkout.payUnavailable}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">{dict.checkout.mockNotice}</p>
          <form action={boundConfirmMock}>
            <button
              type="submit"
              className="h-11 w-full rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {dict.checkout.payMock}
            </button>
          </form>
          <div className="flex gap-3 text-xs text-fg-muted">
            <span className="flex-1 rounded-lg border border-dashed border-border px-3 py-2 text-center">
              {dict.checkout.comingSoonMada}
            </span>
            <span className="flex-1 rounded-lg border border-dashed border-border px-3 py-2 text-center">
              {dict.checkout.comingSoonApplePay}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A terminal order, explained. Three things it must always say: that this
 * order cannot be paid, where the money stands, and the one link that leads
 * somewhere useful — her draft when the order was raised against one, her
 * events list otherwise.
 */
function ClosedOrder({
  locale,
  order,
  dict,
}: {
  locale: Locale;
  order: { id: string; status: OrderStatus; draftEventId: string | null };
  dict: Dictionary;
}) {
  const c = dict.checkout;
  const copy =
    order.status === OrderStatus.CANCELLED
      ? { title: c.closedCancelledTitle, body: c.closedCancelledBody }
      : order.status === OrderStatus.REFUNDED
        ? { title: c.closedRefundedTitle, body: c.closedRefundedBody }
        : { title: c.closedFailedTitle, body: c.closedFailedBody };

  const onward = order.draftEventId
    ? { href: `/${locale}/draft/${order.draftEventId}/activate`, label: c.closedBackToDraft }
    : { href: `/${locale}/events`, label: c.closedBackToEvents };

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-6">
      <h2 className="text-base font-semibold text-fg">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">{copy.body}</p>

      <p className="mt-4 text-xs text-fg-muted">
        {c.closedReference}:{" "}
        <span dir="ltr" className="font-mono">
          {order.id}
        </span>
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={onward.href}
          className="flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {onward.label}
        </Link>
        <a
          href={supportWhatsAppUrl(`${c.closedContactMessage}${order.id}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium text-fg transition-colors hover:border-accent-soft"
        >
          {c.closedContact}
        </a>
      </div>
    </div>
  );
}
