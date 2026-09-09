import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { buildThemeOptions } from "@/lib/events/theme-options";
import { eventFieldDefaults } from "@/lib/events/field-defaults";
import { couplesFor } from "@/lib/events/service";
import { resolveDraftAccess } from "@/lib/drafts/service";
import { deleteDraftAction, saveDraftDetailsAction } from "@/lib/drafts/actions";
import { SAMPLE_BRIDE_GIVEN, SAMPLE_GROOM_GIVEN, usesSampleNames } from "@/lib/drafts/sample";
import { EventFields } from "@/components/events/event-fields";
import { DraftDetailsSubmit } from "@/components/drafts/draft-details-submit";
import { DraftSteps } from "@/components/drafts/draft-steps";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

/**
 * The one edit page of a draft — names, date, venue, the opening, the
 * mothers, the programme, the notes, the music, the design — before payment.
 *
 * It used to be two screens: a three-field "basics" page the gallery landed
 * on, and this full form for whoever wanted to finish everything first. Now
 * the draft is born complete (startDraft writes the sample invitation), so
 * there is nothing for a short form to gate: she arrives here with every field
 * already filled in, changes what is hers, and taps «شاهد دعوتك».
 *
 * The URL carries the draft's id but no secret: opening it in another browser
 * resolves nothing. The key is the httpOnly cookie she got when she picked the
 * design, or her account once she has one.
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
  const sampleNames = usesSampleNames(couplesFor(draft));
  const error = typeof search.error === "string" ? search.error : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <DraftSteps locale={locale} dict={dict} eventId={eventId} current="details" />

      <div>
        <h1 className="text-2xl font-bold text-fg">{d.detailsTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.detailsSubtitle}</p>
      </div>

      {/* Only while the couple is still the sample pair. The activate page
          refuses payment on the same test, so this is the first of two
          warnings, not the only one. */}
      {sampleNames && (
        <p className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-fg">
          {d.sampleNamesNotice
            .replace("{groom}", SAMPLE_GROOM_GIVEN)
            .replace("{bride}", SAMPLE_BRIDE_GIVEN)}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-fg">
          {error === "delete" ? d.deleteBlocked : d.validationError}
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
        <EventFields
          locale={locale}
          dict={dict}
          themeOptions={themeOptions}
          defaults={defaults}
          hideName
        />
        <DraftDetailsSubmit label={d.submit} />
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-fg-muted">{d.savedNotPaid}</p>
        {/* The only self-service deletion someone without an account has, and
            the thing the privacy policy points at. */}
        <form action={deleteDraftAction.bind(null, locale, eventId)}>
          <ConfirmSubmitButton
            confirmMessage={d.deleteConfirm}
            className="text-xs font-bold text-danger hover:underline"
          >
            {d.deleteDraft}
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
