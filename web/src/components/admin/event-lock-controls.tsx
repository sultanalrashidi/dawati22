"use client";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { setEventDetailsLockAction } from "@/lib/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

/**
 * Reopening the CUSTOMER's edit form after her first invitation went out.
 *
 * The thing support most needs to know is written on the panel itself: this
 * does not gate support's own edit. The form above has always ignored the lock
 * and still does. All this decides is whether she can save from her own screen
 * — which is why the sent count is here too, so nobody reopens an event with a
 * hundred and eighty invitations in the wild without seeing that first.
 *
 * A form, never a link: Next prefetches links, and a prefetch that reopens an
 * event is not a control.
 */
export function EventLockControls({
  eventId,
  locale,
  dict,
  lockedAt,
  sentCount,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  lockedAt: Date | null;
  sentCount: number;
}) {
  const a = dict.admin;
  const locked = lockedAt !== null;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const bound = setEventDetailsLockAction.bind(null, eventId, locale, !locked);

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface px-4 py-3">
      <h2 className="text-sm font-bold text-fg">{a.editLockSectionTitle}</h2>
      <p className="mt-1 text-sm text-fg-muted">
        {locked
          ? a.editLockStateLocked.replace(
              "{date}",
              new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(lockedAt),
            )
          : a.editLockStateOpen}
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        {a.editLockSentCount.replace("{count}", nf.format(sentCount))}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{a.editLockNote}</p>

      <form action={bound} className="mt-3">
        <ConfirmSubmitButton
          confirmMessage={a.editLockConfirm}
          className="h-9 rounded-full border border-border px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {locked ? a.editLockReopen : a.editLockRelock}
        </ConfirmSubmitButton>
      </form>
    </section>
  );
}
