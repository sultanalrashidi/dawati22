"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { addGuestAction, type GuestActionState } from "@/lib/guests/actions";

export function AddGuestForm({
  eventId,
  locale,
  dict,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
}) {
  const [state, formAction, isPending] = useActionState<GuestActionState, FormData>(
    addGuestAction.bind(null, eventId, locale),
    null
  );
  const f = dict.events.detail;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.guestNameLabel}</span>
        <input
          name="nameAr"
          required
          minLength={2}
          placeholder={f.guestNamePlaceholder}
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm sm:w-40">
        <span className="text-fg-muted">{f.guestPhoneLabel}</span>
        <input
          name="phone"
          dir="ltr"
          placeholder="05xxxxxxxx"
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm sm:w-32">
        <span className="text-fg-muted">{f.allowedCountLabel}</span>
        <input
          name="allowedCount"
          type="number"
          min={1}
          max={20}
          defaultValue={1}
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {dict.events.detail.addGuest}
      </button>
      {state?.error && (
        <p className="text-sm text-danger sm:basis-full" role="alert">
          {state.error === "name_needs_phone"
            ? f.addGuestErrorNameNeedsPhone
            : state.error === "capacity"
              ? f.capacityReached
              : f.addGuestErrorGeneric}
        </p>
      )}
    </form>
  );
}
