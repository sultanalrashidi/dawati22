import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listOrders } from "@/lib/admin/service";
import { orderSummaryLabel } from "@/lib/orders/terms";
import { riyadhDateFormat } from "@/lib/dates";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";

const STATUS_COLOR: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  FAILED: "bg-danger/10 text-danger",
  CANCELLED: "bg-surface-2 text-fg-muted",
  REFUNDED: "bg-surface-2 text-fg-muted",
};

/**
 * The order ledger, and the one message it has to be able to answer:
 * "دفعت وما وصلني شي".
 *
 * It was four columns — name, amount, provider, status — with no search, so a
 * customer's message could not be matched to a row at all, and you could not
 * tell from the screen whether an order was even from today. So: a search over
 * the three identifiers she can actually produce, a date filter, and the
 * identifiers themselves on the card.
 *
 * The amounts and counts here still come from `orderSummaryLabel`, i.e. from
 * the ORDER — never from the event's capacity. A hand-granted invitation must
 * never appear on a line that also states what was charged.
 */
export default async function AdminOrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  // Its own guard, not only the layout's. This page now prints customer phone
  // numbers and Moyasar payment references; a route that leaks those must not
  // depend on a parent component staying in place.
  await requireUserOrRedirect(locale, [Role.ADMIN]);
  const a = dict.admin;

  const term = typeof search?.q === "string" ? search.q : "";
  const day = typeof search?.day === "string" ? search.day : "";
  const { orders, total, truncated } = await listOrders({ term, day });
  const filtering = Boolean(term || day);

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const stamp = riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.orders}</h1>

      {/* GET, so a found order is a URL support can paste to a colleague. */}
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{a.orderSearchLabel}</span>
          <input
            name="q"
            defaultValue={term}
            placeholder={a.orderSearchPlaceholder}
            className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{a.orderSearchDay}</span>
          <input
            name="day"
            type="date"
            defaultValue={day}
            dir="ltr"
            className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {a.orderSearchSubmit}
        </button>
        {filtering && (
          <Link
            href={`/${locale}/admin/orders`}
            className="h-10 rounded-full border border-border px-5 text-sm leading-10 text-fg-muted transition-colors hover:text-fg"
          >
            {a.orderSearchClear}
          </Link>
        )}
      </form>

      <p className="mt-3 text-xs text-fg-muted">
        {truncated
          ? a.orderSearchShowing
              .replace("{shown}", nf.format(orders.length))
              .replace("{total}", nf.format(total))
          : a.orderSearchCount.replace("{count}", nf.format(total))}
      </p>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">{a.orderSearchEmpty}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-fg">
                  {orderSummaryLabel(order, locale, dict)} — {Number(order.amount)} {dict.common.sar}
                </p>
                {order.discountCode && order.discountAmount !== null && (
                  <p className="mt-0.5 text-sm text-success">
                    {a.discountOrderLine
                      .replace("{code}", order.discountCode.code)
                      .replace("{amount}", nf.format(Number(order.discountAmount)))}
                  </p>
                )}
                <p className="mt-0.5 text-sm text-fg-muted">
                  {dict.admin.customer}: {order.user.name}
                  {order.user.phone && (
                    <>
                      {" · "}
                      <span dir="ltr">{order.user.phone}</span>
                    </>
                  )}
                  {" · "}
                  {order.provider}
                  {order.event && ` · ${order.event.name}`}
                </p>
                {/* The identifiers she can quote back, so the row can be
                    matched to a message instead of only browsed. */}
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                  <span>
                    {a.orderPlacedAt}: {stamp.format(order.createdAt)}
                  </span>
                  {order.event?.referenceCode && (
                    <span>
                      {a.orderReference}:{" "}
                      <span dir="ltr" className="font-mono">
                        {order.event.referenceCode}
                      </span>
                    </span>
                  )}
                  {order.providerRef && (
                    <span className="min-w-0">
                      {a.orderPaymentRef}:{" "}
                      <span dir="ltr" className="font-mono">
                        {order.providerRef}
                      </span>
                    </span>
                  )}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_COLOR[order.status] ?? ""}`}>
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
