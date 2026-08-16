import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDashboardMetrics } from "@/lib/admin/service";

export default async function AdminDashboardPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const metrics = await getDashboardMetrics();

  const cards = [
    [dict.admin.metricEvents, metrics.events],
    [dict.admin.metricInvitations, metrics.invitationsSent],
    [dict.admin.metricAccepted, metrics.rsvpAccepted],
    [dict.admin.metricCheckedIn, metrics.totalCheckedIn],
    [dict.admin.metricOrders, metrics.paidOrders],
    [dict.admin.metricRevenue, `${metrics.revenue.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} ${dict.common.sar}`],
  ] as const;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.dashboard}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-2xl font-semibold text-fg">{value}</p>
            <p className="mt-1 text-sm text-fg-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
