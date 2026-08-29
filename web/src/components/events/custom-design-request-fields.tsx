"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import {
  CUSTOM_DESIGN_PRICE_SAR,
  CUSTOM_DESIGN_REVISIONS_INCLUDED,
} from "@/lib/design-requests/pricing";
import {
  createDesignRequestAction,
  type DesignRequestState,
} from "@/lib/design-requests/actions";

export interface DesignBriefChoice {
  /** Colour keys, the same Arabic tags the gallery filters by. */
  colorTags: readonly { tag: string; label: string }[];
  /** Style keys, the same values Theme.category holds. */
  styles: readonly { value: string; label: string }[];
  /** Existing designs the customer can point at as "close to my idea". */
  designs: readonly { id: string; name: string }[];
}

/**
 * The brief itself — the same questions wherever it is asked from.
 *
 * Structured rather than a single free-text box because a designer can act on
 * "navy, classic, like Ivory Bloom" and cannot act on "something nice", and
 * because every field here reuses vocabulary the customer has already been
 * choosing from in the gallery.
 */
function DesignBriefFields({
  locale,
  dict,
  choices,
}: {
  locale: Locale;
  dict: Dictionary;
  choices: DesignBriefChoice;
}) {
  const [colors, setColors] = useState<string[]>([]);
  const d = dict.designRequest;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  function toggleColor(tag: string) {
    setColors((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs leading-relaxed text-fg-muted">{d.panelIntro}</p>
        <p className="text-xs font-medium leading-relaxed text-accent">
          {d.panelPayLater
            .replace("{price}", nf.format(CUSTOM_DESIGN_PRICE_SAR))
            .replace("{revisions}", nf.format(CUSTOM_DESIGN_REVISIONS_INCLUDED))}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-fg-muted">{d.colorsLabel}</span>
        <div className="flex flex-wrap gap-2">
          {choices.colorTags.map((color) => {
            const active = colors.includes(color.tag);
            return (
              <button
                key={color.tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleColor(color.tag)}
                className={`h-8 rounded-full border px-3 text-xs transition-colors ${
                  active
                    ? "border-accent bg-accent font-medium text-accent-fg"
                    : "border-border bg-bg text-fg-muted hover:border-accent hover:text-accent"
                }`}
              >
                {color.label}
              </button>
            );
          })}
        </div>
        {/* The chips are buttons, so the chosen tags are posted as hidden
            inputs — a <button> contributes nothing to a form submission. */}
        {colors.map((tag) => (
          <input key={tag} type="hidden" name="designColorTags" value={tag} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-fg-muted">{d.styleLabel}</span>
          <select
            name="designStyle"
            defaultValue=""
            className="h-11 rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
          >
            <option value="">{d.stylePlaceholder}</option>
            {choices.styles.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-fg-muted">{d.inspirationLabel}</span>
          <select
            name="designInspirationThemeId"
            defaultValue=""
            className="h-11 rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
          >
            <option value="">{d.inspirationPlaceholder}</option>
            {choices.designs.map((design) => (
              <option key={design.id} value={design.id}>
                {design.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-fg-muted">{d.notesLabel}</span>
        <textarea
          name="designNotes"
          rows={4}
          placeholder={d.notesPlaceholder}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

function Header({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const d = dict.designRequest;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  return (
    <span className="flex-1">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-bold text-fg">{d.cardTitle}</span>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-fg">
          {d.cardPrice.replace("{price}", nf.format(CUSTOM_DESIGN_PRICE_SAR))}
        </span>
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-fg-muted">{d.cardBody}</span>
    </span>
  );
}

/**
 * The request, posted with the event form rather than on a page of its own.
 *
 * It has to ride along with creation: the event form is a one-shot write with
 * no draft state, so sending a customer off to a separate request page mid-form
 * would cost them everything they had typed. Nothing here blocks creation —
 * the event is still made on the stock design they picked, and the custom one
 * replaces it later.
 */
export function CustomDesignRequestFields({
  locale,
  dict,
  choices,
}: {
  locale: Locale;
  dict: Dictionary;
  choices: DesignBriefChoice;
}) {
  const [open, setOpen] = useState(false);
  const d = dict.designRequest;

  return (
    <div className="mt-4 rounded-2xl border border-accent-soft/60 bg-accent-soft/10 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="requestCustomDesign"
          checked={open}
          onChange={(event) => setOpen(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <Header dict={dict} locale={locale} />
      </label>

      {open && (
        <div className="mt-4 border-t border-accent-soft/50 pt-4">
          <DesignBriefFields locale={locale} dict={dict} choices={choices} />
          <p className="mt-4 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-relaxed text-fg-muted">
            {d.panelWaitNote}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The same request, started later from the host's own dashboard — for the
 * customer who created the event first and thought about it afterwards. Same
 * questions, its own form, because there is no event form to ride here.
 */
export function StartDesignRequestCard({
  locale,
  dict,
  eventId,
  choices,
}: {
  locale: Locale;
  dict: Dictionary;
  eventId: string;
  choices: DesignBriefChoice;
}) {
  const [open, setOpen] = useState(false);
  const d = dict.designRequest;
  const bound = createDesignRequestAction.bind(null, eventId, locale);
  const [state, submit, pending] = useActionState<DesignRequestState, FormData>(bound, null);

  return (
    <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/10 p-5">
      <div className="flex items-start gap-3">
        <Header dict={dict} locale={locale} />
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 h-11 w-full rounded-full border border-accent text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg"
        >
          {d.cardCta}
        </button>
      ) : (
        <form action={submit} className="mt-4 border-t border-accent-soft/50 pt-4">
          <DesignBriefFields locale={locale} dict={dict} choices={choices} />
          {state?.error && <p className="mt-3 text-xs text-danger">{dict.common.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-4 h-11 w-full rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? dict.common.loading : d.submitLater}
          </button>
        </form>
      )}
    </section>
  );
}
