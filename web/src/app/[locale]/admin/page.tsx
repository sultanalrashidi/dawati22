import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDashboardMetrics } from "@/lib/admin/service";
import { countAbandonedDrafts, DRAFT_RETENTION_DAYS } from "@/lib/drafts/sweep";
import { sweepAbandonedDraftsAction } from "@/lib/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function AdminDashboardPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const metrics = await getDashboardMetrics();
  // The rehearsal: how many rows the nightly job would take tonight.
  const abandoned = await countAbandonedDrafts();

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

      {/* ── RETENTION ──────────────────────────────────────────────────
          The nightly cron does this on its own; the button is here so the
          first production run can be made deliberately, while somebody is
          watching. Same function, second caller. */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-bold text-fg">{dict.admin.sweepTitle}</h2>
        <p className="mt-1 text-sm text-fg-muted">
          {dict.admin.sweepPending
            .replace("{count}", String(abandoned))
            .replace("{days}", String(DRAFT_RETENTION_DAYS))}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{dict.admin.sweepNote}</p>
        <form action={sweepAbandonedDraftsAction.bind(null, locale)} className="mt-3">
          <ConfirmSubmitButton
            confirmMessage={dict.admin.sweepConfirm}
            className="h-9 rounded-full border border-border px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            {dict.admin.sweepRun}
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
