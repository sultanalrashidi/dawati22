"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { addThemeFontAction, deleteThemeFontAction, type BuilderFormState } from "@/lib/admin/themes/builder-actions";
import { BUILTIN_FONTS, fontStackFor } from "@/lib/themes/font-registry";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const FIELD_CLASS = "h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

export interface GoogleFontRow {
  id: string;
  family: string;
  label: string;
  labelAr: string | null;
  weights: string;
  isArabic: boolean;
}

export function FontLibrary({
  locale,
  dict,
  googleFonts,
}: {
  locale: string;
  dict: Dictionary;
  googleFonts: GoogleFontRow[];
}) {
  const [state, formAction, isPending] = useActionState<BuilderFormState, FormData>(
    addThemeFontAction.bind(null, locale),
    null,
  );
  const a = dict.admin;

  // Clear the form only once the add has actually landed — resetting on click
  // would wipe the fields out from under a submit that then failed.
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold text-fg">{a.builtinFonts}</h2>
        <p className="mt-1 text-sm text-fg-muted">{a.builtinFontsNote}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BUILTIN_FONTS.map((font) => (
            <div key={font.family} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xl text-fg" style={{ fontFamily: fontStackFor(font.family) }}>
                {font.isArabic ? font.labelAr : font.label}
              </p>
              <p className="mt-1 text-xs text-fg-muted" dir="ltr">
                {font.family} · {font.weights.join(", ")}
              </p>
              {font.isArabic && (
                <span className="mt-2 inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                  {a.fontArabicTag}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-fg">{a.googleFontsSection}</h2>
        <p className="mt-1 text-sm text-fg-muted">{a.googleFontsNote}</p>

        {googleFonts.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-fg-muted">
            {a.noGoogleFonts}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {googleFonts.map((font) => (
              <div
                key={font.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-xl text-fg" style={{ fontFamily: fontStackFor(font.family) }}>
                    {font.labelAr ?? font.label}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted" dir="ltr">
                    {font.family} · {font.weights}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {font.isArabic && (
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                      {a.fontArabicTag}
                    </span>
                  )}
                  <form action={deleteThemeFontAction.bind(null, font.id, locale)}>
                    <ConfirmSubmitButton
                      confirmMessage={a.confirmDeleteFont}
                      className="h-9 rounded-full border border-danger/30 px-4 text-xs text-danger hover:bg-danger/10"
                    >
                      {a.delete}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-fg">{a.addFont}</h2>
        <form
          ref={formRef}
          action={formAction}
          className="mt-4 flex max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.fontFamily}</span>
              <input name="family" dir="ltr" required placeholder="Marhey" className={FIELD_CLASS} />
              <span className="text-xs text-fg-muted">{a.fontFamilyHint}</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.fontLabelAr}</span>
              <input name="labelAr" className={FIELD_CLASS} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.fontWeights}</span>
              <input name="weights" dir="ltr" defaultValue="400,700" className={FIELD_CLASS} />
              <span className="text-xs text-fg-muted">{a.fontWeightsHint}</span>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-fg">
              <input
                type="checkbox"
                name="isArabic"
                className="h-4 w-4 rounded border-border accent-accent"
              />
              {a.fontIsArabic}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
            >
              {a.addFont}
            </button>
            {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          </div>
        </form>
      </section>
    </div>
  );
}
