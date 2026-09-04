import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { getOwnedEventForEdit } from "@/lib/events/service";
import { buildThemeOptions } from "@/lib/events/theme-options";
import { eventFieldDefaults } from "@/lib/events/field-defaults";
import { supportWhatsAppUrl } from "@/lib/support";
import { EventFields } from "@/components/events/event-fields";
import { SelfEditForm } from "@/components/events/self-edit-form";

/**
 * Editing a PAID invitation — everything, until the first one actually goes out.
 *
 * The rule the owner settled: the data freezes at the first invitation sent,
 * not at payment, because completing the details and previewing the finished
 * thing both come after paying. So this screen exists in two states, and which
 * one it is depends on a single column.
 *
 * Not a reuse of the draft screens: `resolveDraftAccess` filters `orderId:
 * null` and trusts a browser cookie on an ownerless row. Relaxing either to
 * admit a paid event would hand a paid invitation to whoever holds a cookie.
 */
export default async function OwnedEventDetailsPage({
  params,
}: PageProps<"/[locale]/events/[eventId]/details">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const d = dict.events.detail;

  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);
  const event = await getOwnedEventForEdit(eventId, user.id);
  if (!event) notFound();

  const backToDashboard = (
    <Link href={`/${locale}/events/${eventId}`} className="text-sm font-bold text-accent hover:underline">
      {d.editBackToDashboard}
    </Link>
  );

  if (event.detailsLockedAt !== null) {
    // Deliberately a panel, not a redirect: she followed a link here on
    // purpose, and being bounced back to the dashboard with no explanation
    // reads as a fault rather than as an answer.
    const lockedOn = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(event.detailsLockedAt);

    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold text-fg">{d.lockedTitle}</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            {d.lockedBody.replace("{date}", lockedOn)}
          </p>
        </div>
        <a
          href={supportWhatsAppUrl(
            d.lockedWhatsappMessage
              .replace("{name}", event.name)
              .replace("{reference}", event.referenceCode ?? event.id.slice(-6)),
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {d.lockedSupportCta}
        </a>
        {backToDashboard}
      </div>
    );
  }

  // Her own id, so a privately granted design stays pickable — and the event's
  // current theme, so a design archived after she paid does not silently move
  // her invitation onto whatever happens to be first in the list.
  const themeOptions = await buildThemeOptions(locale, user.id, event.themeId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">{d.editTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.editSubtitle}</p>
      </div>

      {backToDashboard}

      <SelfEditForm eventId={event.id} locale={locale} dict={dict}>
        {/* `EventFields` leaves the type select out — it decides whether the
            rest of the form renders at all — and `readEventForm` requires the
            field, so it is pinned here the way the draft screen pins it. */}
        <input type="hidden" name="type" value={event.type} />
        <EventFields
          locale={locale}
          dict={dict}
          themeOptions={themeOptions}
          defaults={eventFieldDefaults(event, themeOptions)}
        />
      </SelfEditForm>
    </div>
  );
}
