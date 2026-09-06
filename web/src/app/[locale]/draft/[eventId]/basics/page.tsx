import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { couplesFor } from "@/lib/events/service";
import { resolveDraftAccess } from "@/lib/drafts/service";
import { saveDraftBasicsAction, deleteDraftAction } from "@/lib/drafts/actions";
import { DraftBasicsFields } from "@/components/drafts/draft-basics-fields";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { toRiyadhDateTimeLocal } from "@/lib/dates";

/**
 * Step three of the customer's own journey: names, date, venue — and nothing
 * else. She has picked a design and has no account.
 *
 * The URL carries the draft's id but no secret: opening it in another browser
 * resolves nothing and lands back on the gallery. The key is the httpOnly
 * cookie she got when she picked the design, or her account once she has one.
 */
export default async function DraftBasicsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/draft/[eventId]/basics">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const d = dict.draft;

  const draft = await resolveDraftAccess(eventId);
  // Deliberately a redirect to the gallery rather than a 404: someone who
  // opened a stale link should land somewhere they can start, and someone
  // guessing ids learns nothing either way.
  if (!draft) redirect(`/${locale}/themes`);

  const [couple] = couplesFor(draft);
  const error = typeof search.error === "string" ? search.error : null;
  const saved = search.saved === "1";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12 sm:px-8">
      <div>
        <p className="text-sm font-bold text-accent">{d.stepLabel}</p>
        <h1 className="mt-1 text-2xl font-bold text-fg">{d.basicsTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.basicsSubtitle}</p>
      </div>

      {/* The design she picked, so she can see it followed her here — and change
          it without losing anything she has typed. */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <span className="text-sm text-fg">
          {d.chosenDesign}: <b>{locale === "ar" ? draft.theme.nameAr : draft.theme.name}</b>
        </span>
        <Link href={`/${locale}/themes`} className="shrink-0 text-sm font-bold text-accent hover:underline">
          {d.changeDesign}
        </Link>
      </div>

      {saved && (
        <p className="rounded-xl border border-success/40 bg-success/5 px-4 py-3 text-sm text-fg">
          {d.savedConfirm}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-fg">
          {error === "delete" ? d.deleteBlocked : d.validationError}
        </p>
      )}

      <form action={saveDraftBasicsAction.bind(null, locale, eventId)} className="flex flex-col gap-5">
        <DraftBasicsFields
          dict={dict}
          defaults={{
            groomNameAr: couple.groomNameAr ?? "",
            groomFamilyAr: couple.groomFamilyAr ?? "",
            brideNameAr: couple.brideNameAr ?? "",
            brideFamilyAr: couple.brideFamilyAr ?? "",
            // Only pre-filled once she has actually set a date: the placeholder
            // the draft was created with is not a date she chose, and showing
            // it would invite her to accept a wedding day at random.
            eventDateLocal: draft.locationName ? toRiyadhDateTimeLocal(draft.eventDate) : "",
            locationName: draft.locationName,
            regionName: draft.regionName ?? "",
          }}
        />
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

