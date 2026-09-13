"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { saveOwnedEventDetailsAction, type EventSelfEditState } from "@/lib/events/actions";

/**
 * The customer's own edit form over her paid invitation.
 *
 * The same shape as the admin's `EventEditForm`, and for the same reason: the
 * fields stay a server component and arrive as `children`, so support and the
 * customer edit through exactly the same inputs.
 *
 * The one state that only exists here is `locked` — an invitation went out
 * while she had this form open, so the save was refused. She keeps what she
 * typed and is told why, which is the whole reason this reports in place
 * instead of redirecting.
 */
export function SelfEditForm({
  eventId,
  locale,
  dict,
  children,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  children: ReactNode;
}) {
  const action = saveOwnedEventDetailsAction.bind(null, eventId, locale);
  const [state, formAction, isPending] = useActionState<EventSelfEditState, FormData>(action, null);
  const d = dict.events.detail;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {children}

      {state?.error === "locked" && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger">
          {d.editLockedError}
        </p>
      )}
      {(state?.error === "invalid" || state?.error === "unsupported") && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{d.editInvalid}</p>
      )}
      {state?.error === "music" && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger">
          {dict.events.form.musicLinkError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? dict.common.loading : d.editSubmit}
      </button>
    </form>
  );
}
