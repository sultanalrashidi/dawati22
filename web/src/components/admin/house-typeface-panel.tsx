"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { FontOption } from "@/lib/themes/font-registry";
import type { FontCombination } from "@/lib/admin/themes/typography-apply";
import { PRESET_ROLE_KEYS, type TypographyPreset } from "@/lib/themes/typography-preset";
import {
  applyTypographyPresetAction,
  saveTypographyPresetAction,
  type TypographyPresetState,
} from "@/lib/admin/themes/actions";

export interface ThemeChoice {
  id: string;
  name: string;
  category: string;
}

/**
 * One place to set the fonts every design uses.
 *
 * Two buttons, because they are two different promises. Saving only decides
 * what the NEXT design starts from and is reversible by saving again. Applying
 * overwrites the font choice of designs that already exist, cannot be undone,
 * and shows what it is about to flatten first — the catalogue's real variety is
 * printed above the button for exactly that reason.
 */
export function HouseTypefacePanel({
  locale,
  dict,
  preset,
  fonts,
  combinations,
  themes,
  categories,
}: {
  locale: Locale;
  dict: Dictionary;
  preset: TypographyPreset;
  fonts: FontOption[];
  combinations: FontCombination[];
  themes: ThemeChoice[];
  categories: { value: string; label: string }[];
}) {
  const t = dict.admin.typeface;
  const [scopeKind, setScopeKind] = useState<"all" | "category" | "themes">("all");
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [category, setCategory] = useState(categories[0]?.value ?? "");

  const boundSave = saveTypographyPresetAction.bind(null, locale);
  const boundApply = applyTypographyPresetAction.bind(null, locale);
  const [saveState, save, savePending] = useActionState<TypographyPresetState, FormData>(boundSave, null);
  const [applyState, apply, applyPending] = useActionState<TypographyPresetState, FormData>(boundApply, null);

  const total = combinations.reduce((sum, c) => sum + c.count, 0);
  const inScope =
    scopeKind === "all"
      ? total
      : scopeKind === "category"
        ? themes.filter((x) => x.category === category).length
        : picked.length;

  const arabicFonts = fonts.filter((f) => f.isArabic);
  const latinFonts = fonts.filter((f) => !f.isArabic);
  const field =
    "h-11 rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent";

  const roleMeta: Record<(typeof PRESET_ROLE_KEYS)[number], { label: string; options: FontOption[] }> = {
    display: { label: t.roleDisplay, options: arabicFonts },
    body: { label: t.roleBody, options: arabicFonts },
    latin: { label: t.roleLatin, options: latinFonts },
  };

  // Both buttons submit the same fields; only the action differs.
  const roleFields = (
    <div className="grid gap-4 sm:grid-cols-3">
      {PRESET_ROLE_KEYS.map((key) => {
        const meta = roleMeta[key];
        const current = preset[key];
        const options = meta.options.some((f) => f.family === current.family)
          ? meta.options
          : // A family that was removed from the library must still show, or
            // saving would silently move every design off it.
            [
              ...meta.options,
              { family: current.family, label: current.family, labelAr: current.family, source: "GOOGLE", isArabic: true, weights: [current.weight] } as FontOption,
            ];
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg-muted">{meta.label}</span>
              <select name={`${key}Family`} defaultValue={current.family} className={field}>
                {options.map((font) => (
                  <option key={font.family} value={font.family}>
                    {locale === "ar" ? font.labelAr : font.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-fg-muted">{t.weightLabel}</span>
              <select name={`${key}Weight`} defaultValue={String(current.weight)} className={field}>
                <option value="400">{t.weightRegular}</option>
                <option value="500">{t.weightMedium}</option>
                <option value="600">{t.weightSemibold}</option>
                <option value="700">{t.weightBold}</option>
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold text-fg">{t.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{t.body}</p>
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">{t.colourNote}</p>

        <form action={save} className="mt-5 flex flex-col gap-4">
          {roleFields}
          {saveState?.saved && !saveState.applied && (
            <p className="text-sm text-success">{t.savedForNew}</p>
          )}
          <button
            type="submit"
            disabled={savePending}
            className="h-11 w-fit rounded-full border border-accent px-6 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg disabled:opacity-50"
          >
            {savePending ? dict.common.loading : t.saveOnly}
          </button>
        </form>

        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-fg-muted">
          {t.sizeNote}
        </p>
      </section>

      <section className="rounded-2xl border border-warning/40 bg-warning/5 p-5">
        <h2 className="text-base font-bold text-fg">{t.applyTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{t.applyBody}</p>

        {/* What is about to be flattened, before the button that flattens it. */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-bg">
          <table className="w-full min-w-[26rem] text-start text-xs">
            <thead className="text-fg-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-start font-medium">{t.roleDisplay}</th>
                <th className="px-3 py-2 text-start font-medium">{t.roleBody}</th>
                <th className="px-3 py-2 text-start font-medium">{t.roleLatin}</th>
                <th className="px-3 py-2 text-start font-medium">{t.designCount}</th>
              </tr>
            </thead>
            <tbody>
              {combinations.map((c) => (
                <tr key={`${c.display}|${c.body}|${c.latin}`} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-fg">{c.display}</td>
                  <td className="px-3 py-2 text-fg">{c.body}</td>
                  <td className="px-3 py-2 text-fg">{c.latin}</td>
                  <td className="px-3 py-2 font-bold text-fg tabular-nums">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={apply} className="mt-5 flex flex-col gap-4">
          {roleFields}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{t.scopeLabel}</span>
            <input type="hidden" name="scopeKind" value={scopeKind} />
            <div className="flex flex-wrap gap-2">
              {(["all", "category", "themes"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={scopeKind === kind}
                  onClick={() => {
                    setScopeKind(kind);
                    setConfirming(false);
                  }}
                  className={`h-9 rounded-full border px-4 text-xs transition-colors ${
                    scopeKind === kind
                      ? "border-accent bg-accent font-medium text-accent-fg"
                      : "border-border text-fg-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  {kind === "all" ? t.scopeAll : kind === "category" ? t.scopeCategory : t.scopePick}
                </button>
              ))}
            </div>

            {scopeKind === "category" && (
              <select
                name="scopeCategory"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setConfirming(false);
                }}
                className={`${field} w-fit`}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}

            {scopeKind === "themes" && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-bg p-3">
                {themes.map((theme) => (
                  <label key={theme.id} className="flex items-center gap-2 py-1 text-sm text-fg">
                    <input
                      type="checkbox"
                      name="scopeThemeIds"
                      value={theme.id}
                      checked={picked.includes(theme.id)}
                      onChange={(e) => {
                        setPicked((prev) =>
                          e.target.checked ? [...prev, theme.id] : prev.filter((id) => id !== theme.id),
                        );
                        setConfirming(false);
                      }}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {theme.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {applyState?.error && <p className="text-sm text-danger">{t.scopeRequired}</p>}
          {applyState?.applied !== undefined && (
            <p className="text-sm text-success">
              {t.appliedCount.replace("{count}", String(applyState.applied))}
            </p>
          )}

          {/* Two presses, because the first one cannot be taken back. */}
          {!confirming ? (
            <button
              type="button"
              disabled={inScope === 0}
              onClick={() => setConfirming(true)}
              className="h-11 w-fit rounded-full bg-warning/20 px-6 text-sm font-bold text-fg transition-colors hover:bg-warning/30 disabled:opacity-50"
            >
              {t.applyCta.replace("{count}", String(inScope))}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-fg">
                {t.confirmQuestion.replace("{count}", String(inScope))}
              </span>
              <button
                type="submit"
                disabled={applyPending}
                className="h-11 rounded-full bg-danger px-6 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {applyPending ? dict.common.loading : t.confirmYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-sm text-fg-muted underline-offset-4 hover:underline"
              >
                {t.confirmNo}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
