import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedOrder } from "@/lib/orders/service";
import { orderSummaryLabel } from "@/lib/orders/terms";
import { isMoyasarConfigured, moyasarFormConfig } from "@/lib/payments/moyasar";
import { confirmMockPaymentAction } from "@/lib/orders/actions";
import { MoyasarForm } from "@/components/checkout/moyasar-form";
import { Role } from "@/generated/prisma/client";

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

      {order.status === "PAID" ? (
        <p className="mt-6 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{dict.common.success}</p>
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
