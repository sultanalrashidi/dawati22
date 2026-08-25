"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { createBuilderThemeAction, type BuilderFormState } from "@/lib/admin/themes/builder-actions";

const FIELD_CLASS = "h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

/** Mirrors ThemeOccasion in the schema — spelled out so the browser bundle
 * never has to pull in the generated Prisma client. */
const OCCASIONS = ["WEDDING", "ENGAGEMENT", "BIRTHDAY", "BACHELORETTE"] as const;

/** The same style categories the customer gallery filters on (theme-gallery-grid). */
const CATEGORIES = [
  { value: "luxury", dictKey: "categoryLuxury" },
  { value: "soft", dictKey: "categorySoft" },
  { value: "modern", dictKey: "categoryModern" },
  { value: "classic", dictKey: "categoryClassic" },
  { value: "romantic", dictKey: "categoryRomantic" },
  { value: "minimal", dictKey: "categorySimple" },
  { value: "dark", dictKey: "categoryDark" },
  { value: "botanical", dictKey: "categoryBotanical" },
  { value: "experimental", dictKey: "categoryExperimental" },
  { value: "saudi", dictKey: "categorySaudi" },
] as const;

export function CreateThemeForm({ locale, dict }: { locale: string; dict: Dictionary }) {
  const action = createBuilderThemeAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<BuilderFormState, FormData>(action, null);
  const a = dict.admin;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.planNameAr}</span>
          <input name="nameAr" required className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.planNameEn}</span>
          <input name="name" dir="ltr" required className={FIELD_CLASS} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.slug}</span>
        <input
          name="slug"
          dir="ltr"
          required
          pattern="[a-z0-9\-]+"
          placeholder="rose-gold"
          className={FIELD_CLASS}
        />
        <span className="text-xs text-fg-muted">{a.slugHint}</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.occasion}</span>
          <select name="occasion" defaultValue="WEDDING" className={FIELD_CLASS}>
            {OCCASIONS.map((occasion) => (
              <option key={occasion} value={occasion}>
                {a.themeOccasion[occasion]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.category}</span>
          <select name="category" defaultValue="classic" className={FIELD_CLASS}>
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {dict.themesGallery[category.dictKey]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.descriptionArLabel}</span>
        <textarea
          name="descriptionAr"
          rows={3}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
        />
      </label>

      <p className="rounded-xl bg-surface-2 p-3 text-xs text-fg-muted">{a.builderNextStepNote}</p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {a.createThemeSubmit}
        </button>
        {state?.error && <p className="whitespace-pre-line text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
