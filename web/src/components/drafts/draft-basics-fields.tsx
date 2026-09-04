"use client";

import { useFormStatus } from "react-dom";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export interface DraftBasicsDefaults {
  groomNameAr: string;
  groomFamilyAr: string;
  brideNameAr: string;
  brideFamilyAr: string;
  /** `YYYY-MM-DDTHH:mm`, in the same clock the server parses back. */
  eventDateLocal: string;
  locationName: string;
  regionName: string;
}

const FIELD =
  "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

/**
 * The whole free form: who is getting married, when, and where.
 *
 * Everything else an invitation carries — the opening verse, the mothers' host
 * line, the closing, the notes, the programme, the music — has a default good
 * enough to print a complete card, and is asked for after payment. That is the
 * point of this screen: three answers and she sees her own invitation.
 *
 * The field names match the ones readCouples already reads, so the draft form
 * and the full form parse through exactly the same validator.
 */
export function DraftBasicsFields({
  dict,
  defaults,
}: {
  dict: Dictionary;
  defaults?: DraftBasicsDefaults;
}) {
  const d = dict.draft;

  return (
    <>
      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-bold text-fg">{d.coupleLegend}</legend>

        {/* Groom first, as everywhere the two names appear together. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{d.groomNameLabel}</span>
            <input
              name="coupleGroomNameAr"
              required
              minLength={2}
              maxLength={60}
              defaultValue={defaults?.groomNameAr ?? ""}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{d.groomFamilyLabel}</span>
            <input
              name="coupleGroomFamilyAr"
              maxLength={60}
              defaultValue={defaults?.groomFamilyAr ?? ""}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{d.brideNameLabel}</span>
            <input
              name="coupleBrideNameAr"
              required
              minLength={2}
              maxLength={60}
              defaultValue={defaults?.brideNameAr ?? ""}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{d.brideFamilyLabel}</span>
            <input
              name="coupleBrideFamilyAr"
              maxLength={60}
              defaultValue={defaults?.brideFamilyAr ?? ""}
              className={FIELD}
            />
          </label>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{d.dateLabel}</span>
        <input
          type="datetime-local"
          name="eventDate"
          required
          defaultValue={defaults?.eventDateLocal ?? ""}
          className={FIELD}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{d.venueLabel}</span>
          <input
            name="locationName"
            required
            minLength={2}
            maxLength={120}
            placeholder={d.venuePlaceholder}
            defaultValue={defaults?.locationName ?? ""}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{d.regionLabel}</span>
          <input
            name="regionName"
            maxLength={60}
            defaultValue={defaults?.regionName ?? ""}
            className={FIELD}
          />
        </label>
      </div>

      <SubmitButton label={d.submit} />
    </>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-full bg-fg text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
