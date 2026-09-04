import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { buildThemeOptions } from "@/lib/events/theme-options";
import { eventFieldDefaults } from "@/lib/events/field-defaults";
import { resolveDraftAccess } from "@/lib/drafts/service";
import { saveDraftDetailsAction } from "@/lib/drafts/actions";
import { EventFields } from "@/components/events/event-fields";
import { DraftDetailsSubmit } from "@/components/drafts/draft-details-submit";

/**
 * Everything the three-field form did not ask for — the opening, the mothers'
 * names, the closing, the programme, the notes, the music, the map, the design
 * — available BEFORE payment.
 *
 * It was originally going to sit after payment, on the grounds that a shorter
 * form gets her to the preview faster. Both turn out to be true at once: the
 * three fields remain the fast lane to seeing her invitation, and this is here
 * for whoever wants to finish the whole thing first. Nothing here is required.
 */
export default async function DraftDetailsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/draft/[eventId]/details">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const d = dict.draft;

  const draft = await resolveDraftAccess(eventId);
  // An activated invitation is edited from its own dashboard, under the rules
  // that apply once guests may already have been invited.
  if (!draft) redirect(`/${locale}/events/${eventId}`);

  const user = await getSessionUser();
  const themeOptions = await buildThemeOptions(locale, user?.id ?? null);
  const defaults = eventFieldDefaults(draft, themeOptions);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <div>
        <p className="text-sm font-bold text-accent">{d.detailsStep}</p>
        <h1 className="mt-1 text-2xl font-bold text-fg">{d.detailsTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.detailsSubtitle}</p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/preview/${eventId}`} className="font-bold text-accent hover:underline">
          {d.detailsBackToPreview}
        </Link>
      </div>

      {search.error && (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-fg">
          {d.validationError}
        </p>
      )}

      <form
        action={saveDraftDetailsAction.bind(null, locale, eventId)}
        className="flex flex-col gap-5"
      >
        {/* The create form gets this from the event-type picker it is wrapped
            in; a draft has no picker because it is a wedding by construction
            (startDraft hard-wires it), and readEventForm requires the field. */}
        <input type="hidden" name="type" value={draft.type} />
        <EventFields locale={locale} dict={dict} themeOptions={themeOptions} defaults={defaults} />
        <DraftDetailsSubmit label={d.detailsSubmit} />
      </form>
    </div>
  );
}
