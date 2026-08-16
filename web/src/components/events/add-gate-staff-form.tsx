"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { addGateStaffAction, type GateStaffActionState } from "@/lib/gatestaff/actions";

export function AddGateStaffForm({
  eventId,
  locale,
  dict,
  disabled,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  disabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState<GateStaffActionState, FormData>(
    addGateStaffAction.bind(null, eventId, locale),
    null
  );
  const f = dict.events.detail;
  const a = dict.auth;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{a.nameLabel}</span>
        <input
          name="name"
          required
          minLength={2}
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{a.phoneLabel}</span>
        <input
          name="phone"
          dir="ltr"
          required
          placeholder={a.phonePlaceholder}
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || disabled}
        className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {f.addGateStaff}
      </button>
      {state?.error && <p className="text-sm text-danger sm:basis-full">{state.error}</p>}
    </form>
  );
}
