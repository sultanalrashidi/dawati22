import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listOrders } from "@/lib/admin/service";
import { orderSummaryLabel } from "@/lib/orders/terms";

const STATUS_COLOR: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  FAILED: "bg-danger/10 text-danger",
  CANCELLED: "bg-surface-2 text-fg-muted",
  REFUNDED: "bg-surface-2 text-fg-muted",
};

export default async function AdminOrdersPage({ params }: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const orders = await listOrders();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.orders}</h1>
      <div className="mt-6 flex flex-col gap-2">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="font-medium text-fg">
                {orderSummaryLabel(order, locale, dict)} — {Number(order.amount)} {dict.common.sar}
              </p>
              <p className="text-sm text-fg-muted">
                {dict.admin.customer}: {order.user.name} · {order.provider}
                {order.event && ` · ${order.event.name}`}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_COLOR[order.status] ?? ""}`}>
              {order.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
