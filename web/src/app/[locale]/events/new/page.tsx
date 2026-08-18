import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { listEligibleOrders, listPublishedThemes } from "@/lib/events/service";
import { createEventAction } from "@/lib/events/actions";
import { Role } from "@/generated/prisma/client";
import { ThemePicker } from "@/components/events/theme-picker";

const EVENT_TYPE_OPTIONS = [
  ["WEDDING", "typeWedding"],
  ["ENGAGEMENT", "typeEngagement"],
  ["GRADUATION", "typeGraduation"],
  ["BIRTHDAY", "typeBirthday"],
  ["ANNIVERSARY", "typeAnniversary"],
  ["CORPORATE", "typeCorporate"],
  ["OTHER", "typeOther"],
] as const;

export default async function NewEventPage({
  params,
  searchParams,
}: PageProps<"/[locale]/events/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const [eligibleOrders, themes] = await Promise.all([
    listEligibleOrders(user.id),
    listPublishedThemes(),
  ]);

  if (eligibleOrders.length === 0) redirect(`/${locale}/plans`);

  const preselectedOrderId =
    typeof search?.orderId === "string" && eligibleOrders.some((o) => o.id === search.orderId)
      ? search.orderId
      : eligibleOrders[0].id;

  const boundCreateEvent = createEventAction.bind(null, locale);
  const f = dict.events.form;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold text-fg">{dict.events.newTitle}</h1>

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
                <option key={order.id} value={order.id}>
                  {locale === "ar" ? order.plan.nameAr : order.plan.name} — {order.plan.invitationCount}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="orderId" value={preselectedOrderId} />
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.typeLabel}</span>
          <select
            name="type"
            defaultValue="WEDDING"
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          >
            {EVENT_TYPE_OPTIONS.map(([value, key]) => (
              <option key={value} value={value}>
                {f[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.nameLabel}</span>
          <input
            name="name"
            required
            minLength={2}
            placeholder={f.namePlaceholder}
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{f.groomNameLabel}</span>
            <input
              name="groomNameEn"
              dir="ltr"
              required
              minLength={2}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{f.brideNameLabel}</span>
            <input
              name="brideNameEn"
              dir="ltr"
              required
              minLength={2}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.invitationTextLabel}</span>
          <textarea
            name="invitationTextAr"
            required
            minLength={5}
            rows={4}
            placeholder={f.invitationTextPlaceholder}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.dateLabel}</span>
          <input
            type="datetime-local"
            name="eventDate"
            required
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{f.locationNameLabel}</span>
            <input
              name="locationName"
              required
              minLength={2}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{f.mapUrlLabel}</span>
            <input
              name="mapUrl"
              type="url"
              dir="ltr"
              className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.musicUrlLabel}</span>
          <input
            name="musicUrl"
            type="url"
            dir="ltr"
            placeholder={f.musicUrlPlaceholder}
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
          <span className="text-xs text-fg-muted">{f.musicUrlHint}</span>
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <span className="text-fg-muted">{f.themeLabel}</span>
          <ThemePicker
            dict={dict}
            themes={themes.map((t) => ({
              id: t.id,
              name: locale === "ar" ? t.nameAr : t.name,
              category: t.category,
              config: t.config as unknown as import("@/lib/themes/types").ThemeConfig,
            }))}
          />
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <span className="text-fg-muted">{f.guestManagementLabel}</span>
          <label className="flex items-center gap-2">
            <input type="radio" name="guestManagementMode" value="SELF" defaultChecked />
            {f.guestManagementSelf}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="guestManagementMode" value="ADMIN" />
            {f.guestManagementAdmin}
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="rsvpRequired" defaultChecked />
          {f.rsvpRequiredLabel}
        </label>

        <button
          type="submit"
          className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {f.submit}
        </button>
      </form>
    </div>
  );
}
