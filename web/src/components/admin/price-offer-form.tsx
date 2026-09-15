"use client";

import { startTransition, useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { savePriceOfferAction, stopPriceOfferAction, type OfferFormState } from "@/lib/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { OfferPhase } from "@/lib/orders/offer";

const FIELD =
  "h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

/**
 * The price offer, under the two regular rates: a name, the two offer prices
 * and when it runs. Saving switches it on; it then starts and stops by itself.
 */
export function PriceOfferForm({
  locale,
  dict,
  phase,
  statusLine,
  defaults,
}: {
  locale: string;
  dict: Dictionary;
  phase: OfferPhase;
  /** Where the offer stands, already worded and dated by the server. */
  statusLine: string;
  /** The stored offer, dates as Riyadh `datetime-local` values; start defaults to now. */
  defaults: {
    nameAr: string;
    nameEn: string;
    withQr: number | null;
    noQr: number | null;
    startsAt: string;
    endsAt: string;
  };
}) {
  const action = savePriceOfferAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<OfferFormState, FormData>(action, null);
  const a = dict.admin;
  const running = phase === "live" || phase === "scheduled";

  return (
    <section className="mt-10 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-fg">{a.offerTitle}</h2>
      <p className="mt-1 max-w-prose text-sm text-fg-muted">{a.offerIntro}</p>
      <p
        className={`mt-3 w-fit rounded-lg px-3 py-1.5 text-xs font-bold ${
          phase === "live" ? "bg-success/10 text-success" : "bg-surface-2 text-fg-muted"
        }`}
      >
        {statusLine}
      </p>

      {/* Submitted by hand rather than through `action`, which resets every
          field once it returns — a refused date would wipe the whole offer. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.offerNameAr}</span>
            <input
              name="nameAr"
              required
              maxLength={60}
              defaultValue={defaults.nameAr}
              placeholder={a.offerNameArPlaceholder}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.offerNameEn}</span>
            <input
              name="nameEn"
              maxLength={60}
              dir="ltr"
              defaultValue={defaults.nameEn}
              placeholder="National Day offer"
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.offerPriceQr}</span>
            <input
              name="withQr"
              type="number"
              step="0.01"
              min="0.25"
              max="100"
              required
              dir="ltr"
              defaultValue={defaults.withQr ?? ""}
              className={`${FIELD} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.offerPriceNoQr}</span>
            <input
              name="noQr"
              type="number"
              step="0.01"
              min="0.25"
              max="100"
              required
              dir="ltr"
              defaultValue={defaults.noQr ?? ""}
              className={`${FIELD} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.offerStartsAt}</span>
            <input
              name="startsAt"
              type="datetime-local"
              required
              dir="ltr"
              defaultValue={defaults.startsAt}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.offerEndsAt}</span>
            <input
              name="endsAt"
              type="datetime-local"
              required
              dir="ltr"
              defaultValue={defaults.endsAt}
              className={FIELD}
            />
          </label>
        </div>
        <p className="text-xs text-fg-muted">{a.offerTimeNote}</p>

        {state?.error && <p className="text-sm text-danger">{a.offerErrors[state.error]}</p>}
        {state?.saved && !isPending && <p className="text-sm text-success">{a.offerSaved}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="h-10 w-fit rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? dict.common.loading : a.offerSave}
        </button>
      </form>

      {running && (
        <form action={stopPriceOfferAction.bind(null, locale)} className="mt-3">
          <ConfirmSubmitButton
            confirmMessage={a.offerStopConfirm}
            className="h-10 rounded-full border border-danger/40 px-5 text-sm font-medium text-danger transition-colors hover:bg-danger/5"
          >
            {a.offerStop}
          </ConfirmSubmitButton>
        </form>
      )}
    </section>
  );
}
