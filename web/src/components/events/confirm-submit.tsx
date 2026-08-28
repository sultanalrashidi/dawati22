"use client";

import { useState } from "react";

/**
 * The last step of the create form. The event's names, date and venue are
 * printed on every guest's invitation and entry pass and the customer cannot
 * change them afterwards, so the submit button waits behind an explicit "I
 * checked this" — the acknowledgement is the point, not the click.
 *
 * `required` on the checkbox is what enforces it without JavaScript; the
 * disabled button is what makes the requirement visible before the customer
 * reaches for it. The server checks the tick as well.
 */
export function ConfirmSubmit({
  label,
  hint,
  submitLabel,
}: {
  label: string;
  hint: string;
  submitLabel: string;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-fg">
        <input
          type="checkbox"
          name="confirmAccuracy"
          required
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span>{label}</span>
      </label>

      <button
        type="submit"
        disabled={!confirmed}
        className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>

      {!confirmed && <span className="text-xs text-fg-muted">{hint}</span>}
    </div>
  );
}
