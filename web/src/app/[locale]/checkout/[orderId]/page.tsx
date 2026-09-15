import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedOrder, paidOrderDestination } from "@/lib/orders/service";
import { isPayableOrderStatus } from "@/lib/orders/status";
import { orderSummaryLabel } from "@/lib/orders/terms";
import { isMoyasarConfigured, moyasarFormConfig } from "@/lib/payments/moyasar";
import {
  applyDiscountCodeAction,
  confirmMockPaymentAction,
  removeDiscountCodeAction,
  settleFreeOrderAction,
} from "@/lib/orders/actions";
import { orderCodeRefusal } from "@/lib/discounts/service";
import { isDiscountRefusal } from "@/lib/discounts/rules";
import { MoyasarForm } from "@/components/checkout/moyasar-form";
import { PendingSubmit } from "@/components/checkout/pending-submit";
import { OrderKind, OrderStatus, PaymentProvider, Role } from "@/generated/prisma/client";
import { supportWhatsAppUrl } from "@/lib/support";

/*
 * Only an order that can still settle is offered the card form: PENDING, or
 * FAILED after a declined card, which she can simply try again.
 *
 * `confirmMoyasarPayment` enforces the same rule server-side, but by the time
 * it runs Moyasar has already taken the card: a page that offers a live card
 * form for a superseded or refunded order is a page that charges a customer
 * for something that can never be activated. So every closed status gets told
 * where its money is and where to go next instead.
 */

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
  const c = dict.checkout;
  const money = (sar: number) =>
    `${sar.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} ${dict.common.sar}`;

  const payable = isPayableOrderStatus(order.status);
  // Only an order for invitations, priced per invitation, takes a code: the
  // design fee is a quoted price for one piece of work.
  const takesCode =
    order.kind === OrderKind.INVITATIONS &&
    Boolean(order.draftEventId && order.tier && order.invitationCount);
  // A code already on the order is asked again before any card form is
  // offered: switched off, expired or used up since, it no longer prices this.
  const staleCode =
    payable && order.discountCodeId ? await orderCodeRefusal(order.discountCodeId) : null;
  const codeNotice = isDiscountRefusal(search?.code) ? c.codeErrors[search.code] : null;
  const isFree = order.provider === PaymentProvider.FREE && Number(order.amount) === 0;
  const discount = order.discountAmount !== null ? Number(order.discountAmount) : null;
  // After a declined card the order is FAILED and the form comes back — so the
  // page says what happened and that trying again is fine. `?error=1` alone
  // covers the rarer refusal that leaves the order as it was.
  const notice =
    order.status === OrderStatus.FAILED
      ? dict.checkout.retryNotice
      : search?.error === "1"
        ? dict.checkout.error
        : null;

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
          {/* The stored figures, never re-derived: amount is what is charged,
              and the price before the code is amount plus what it took off. */}
          {discount !== null && order.discountCode && (
            <>
              <div className="flex justify-between text-sm">
                <dt className="text-fg-muted">{c.subtotal}</dt>
                <dd className="tabular-nums">{money(Number(order.amount) + discount)}</dd>
              </div>
              <div className="flex justify-between text-sm text-success">
                <dt>
                  {c.discountLine}{" "}
                  <span dir="ltr" className="font-mono font-bold">
                    {order.discountCode.code}
                  </span>
                </dt>
                <dd className="tabular-nums">−{money(discount)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-semibold">
            <dt>{dict.checkout.amount}</dt>
            <dd>{isFree ? c.free : money(Number(order.amount))}</dd>
          </div>
        </dl>
      </div>

      {notice && <p className="mt-4 text-sm text-danger">{notice}</p>}

      {!payable ? (
        <ClosedOrder locale={locale} order={order} dict={dict} />
      ) : staleCode && order.discountCode ? (
        // The code no longer holds. No card form — paying now would charge
        // the old discounted price — only the way on without it.
        <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/5 p-5">
          <p className="text-sm leading-relaxed text-fg">
            {c.codeStale
              .replace("{code}", order.discountCode.code)
              .replace("{reason}", c.codeErrors[staleCode])}
          </p>
          <form action={removeDiscountCodeAction.bind(null, order.id, locale)} className="mt-4">
            <PendingSubmit
              label={c.continueWithoutCode}
              pendingLabel={dict.common.loading}
              className="h-11 w-full rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
            />
          </form>
        </div>
      ) : isFree ? (
        // Normally settled the moment the code was applied; this is the way
        // back in if that step was interrupted.
        <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-5">
          <p className="text-base font-bold text-fg">{c.freeTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{c.freeBody}</p>
          <form action={settleFreeOrderAction.bind(null, order.id, locale)} className="mt-4">
            <PendingSubmit
              label={c.freeActivate}
              pendingLabel={dict.common.loading}
              className="h-11 w-full rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
            />
          </form>
        </div>
      ) : isMoyasarConfigured() ? (
        <div className="mt-6 space-y-4">
          {takesCode && <DiscountCodeBox locale={locale} order={order} dict={dict} error={codeNotice} />}
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
          {takesCode && <DiscountCodeBox locale={locale} order={order} dict={dict} error={codeNotice} />}
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
 * «عندك كود خصم؟» — or, once one is on the order, its name and a way to take it
 * off. Both are plain forms: applying or removing a code raises a fresh order
 * and lands on its checkout.
 */
function DiscountCodeBox({
  locale,
  order,
  dict,
  error,
}: {
  locale: Locale;
  order: { id: string; discountCode: { code: string } | null };
  dict: Dictionary;
  /** Why the last code she typed was refused, printed under the field. */
  error: string | null;
}) {
  const c = dict.checkout;
  if (order.discountCode) {
    return (
      <form
        action={removeDiscountCodeAction.bind(null, order.id, locale)}
        className="flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm"
      >
        <span className="text-fg">
          {c.codeApplied}{" "}
          <b dir="ltr" className="font-mono">
            {order.discountCode.code}
          </b>
        </span>
        <PendingSubmit
          label={c.codeRemove}
          pendingLabel={dict.common.loading}
          className="shrink-0 text-xs font-bold text-danger hover:underline"
        />
      </form>
    );
  }
  return (
    <form
      action={applyDiscountCodeAction.bind(null, order.id, locale)}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <label htmlFor="discount-code" className="text-sm font-medium text-fg">
        {c.codeLabel}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="discount-code"
          name="code"
          required
          maxLength={30}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={c.codePlaceholder}
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-bg px-4 font-mono uppercase text-fg outline-none placeholder:font-sans placeholder:normal-case focus:border-accent"
        />
        <PendingSubmit
          label={c.codeApply}
          pendingLabel={dict.common.loading}
          className="h-11 shrink-0 rounded-full border border-accent px-5 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg"
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
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
  // Only CANCELLED and REFUNDED reach here: PAID redirects before rendering,
  // and PENDING and FAILED get the card form.
  const copy =
    order.status === OrderStatus.REFUNDED
      ? { title: c.closedRefundedTitle, body: c.closedRefundedBody }
      : { title: c.closedCancelledTitle, body: c.closedCancelledBody };

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
