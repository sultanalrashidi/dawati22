"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { updateEventDetailsAction, type EventEditState } from "@/lib/admin/actions";

/**
 * The <form> around the shared event fields. The fields themselves stay a
 * server component and arrive as `children`, so the admin form and the customer
 * form render the very same inputs — only the wrapper differs.
 *
 * It reports the outcome in place instead of redirecting: a failed save must
 * leave the admin looking at what they typed, not at a blank form.
 */
export function EventEditForm({
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
  const action = updateEventDetailsAction.bind(null, eventId, locale);
  const [state, formAction, isPending] = useActionState<EventEditState, FormData>(action, null);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      {children}

      {state?.error && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{dict.admin.invalidForm}</p>
      )}
      {state?.saved && !isPending && (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          {dict.admin.eventEditSaved}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? dict.common.loading : dict.common.save}
      </button>
    </form>
  );
}
