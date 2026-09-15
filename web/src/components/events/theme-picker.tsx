"use client";


import { useMemo, useState } from "react";
import type { ThemeConfig } from "@/lib/themes/types";
import type { EnvelopeCutout } from "@/lib/themes/thumbnail";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { BuilderTheme } from "@/components/guest/invitation-view";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";
import { EnvelopeThumbnail } from "@/components/themes/envelope-thumbnail";
import { CustomDesignRequestFields } from "@/components/events/custom-design-request-fields";
import {
  THEME_CATEGORIES,
  THEME_COLORS,
  themeCategoryLabel,
  themeColorLabel,
} from "@/lib/themes/vocabulary";

/**
 * One selectable option. A LEGACY theme contributes exactly one (each of its
 * colours is its own Theme row); a BUILDER theme contributes one per colour,
 * all sharing a `themeId` and differing by `variantId`.
 */
export interface ThemeOption {
  /** Unique per option — `themeId` for legacy, `themeId:variantId` otherwise. */
  key: string;
  themeId: string;
  variantId: string | null;
  name: string;
  /** The colour's own name, shown under the design name when there is one. */
  variantName?: string;
  category: string;
  config: ThemeConfig;
  builder?: BuilderTheme;
  /** Groups the colours of one design onto a single card. */
  familyKey: string;
  /** Arabic colour-family label, the same vocabulary the gallery filters by. */
  colorTag?: string;
  /** The design's own closed-envelope art, when it has any. */
  thumbnailUrl?: string;
  /** Set when that art must be cut out of its photograph — see `builderThemeThumbnail`. */
  thumbnailCutout?: EnvelopeCutout;
}

interface Family {
  key: string;
  name: string;
  category: string;
  members: ThemeOption[];
}

function buildFamilies(options: ThemeOption[]): Family[] {
  const groups = new Map<string, ThemeOption[]>();
  for (const option of options) {
    const list = groups.get(option.familyKey);
    if (list) list.push(option);
    else groups.set(option.familyKey, [option]);
  }
  return Array.from(groups.entries()).map(([key, members]) => ({
    key,
    name: members[0].name,
    category: members[0].category,
    members,
  }));
}

function colorCountLabel(n: number, dict: Dictionary, nf: Intl.NumberFormat) {
  const g = dict.themesGallery;
  if (n === 1) return g.colorCountOne;
  if (n === 2) return g.colorCountTwo;
  if (n <= 10) return g.colorCountFew.replace("{n}", nf.format(n));
  return g.colorCountMany.replace("{n}", nf.format(n));
}

/**
 * The design chooser inside the event form.
 *
 * It shows the design's own closed-envelope photo rather than a swatch of its
 * palette: two colours of the same art produced two near-identical gradients,
 * which told the customer nothing about what they were buying and made 26
 * tiles read as noise. Colours of one design now share a card, which is also
 * what the public gallery does — the same catalogue should not look like two
 * different catalogues either side of the purchase.
 */
export function ThemePicker({
  locale,
  options,
  dict,
  defaultKey,
  allowCustomRequest = false,
  hasQr = true,
}: {
  locale: Locale;
  options: ThemeOption[];
  dict: Dictionary;
  /** Preselects an existing choice when the form is an edit rather than a create. */
  defaultKey?: string;
  /** Without a barcode the preview ends on the no-barcode card. */
  hasQr?: boolean;
  /**
   * Offers "have one designed for me" under the grid. Create form only — the
   * admin edit form rewrites an existing event and must not open a request.
   */
  allowCustomRequest?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState(
    defaultKey && options.some((o) => o.key === defaultKey) ? defaultKey : (options[0]?.key ?? ""),
  );
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [color, setColor] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Which colour of a design is on show, once the customer has touched it. */
  const [shownByFamily, setShownByFamily] = useState<Record<string, string>>({});

  const families = useMemo(() => buildFamilies(options), [options]);
  // Arabic reads its own digits; English must not be forced into them.
  const nf = useMemo(
    () => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US"),
    [locale],
  );
  const selected = options.find((o) => o.key === selectedKey) ?? options[0];

  const g = dict.themesGallery;
  const f = dict.events.form;
  const categoryDbValue = THEME_CATEGORIES.find((c) => c.key === category)?.dbValue ?? null;
  const query = search.trim().toLowerCase();
  const hasFilters = Boolean(query) || category !== "all" || color !== null;

  const visible = families.filter((family) => {
    if (query && !family.name.toLowerCase().includes(query)) return false;
    if (categoryDbValue && family.category !== categoryDbValue) return false;
    if (color && !family.members.some((m) => m.colorTag === color)) return false;
    return true;
  });

  /**
   * Derived rather than stored, so a card always shows something sensible
   * before it has been touched: the chosen colour if this is the chosen
   * design, then the colour being filtered for, then the first.
   */
  function shownIn(family: Family): ThemeOption {
    const touched = family.members.find((m) => m.key === shownByFamily[family.key]);
    if (touched) return touched;
    const chosen = family.members.find((m) => m.key === selectedKey);
    if (chosen) return chosen;
    if (color) {
      const match = family.members.find((m) => m.colorTag === color);
      if (match) return match;
    }
    return family.members[0];
  }

  const previewFamily = previewKey
    ? families.find((fam) => fam.members.some((m) => m.key === previewKey))
    : undefined;

  return (
    <div>
      {/*
        The submitted pair. Two hidden inputs rather than a radio per card
        because a colour needs BOTH ids — sending only `themeId`, as this picker
        used to, silently gave every customer the design's default colour no
        matter which swatch they picked.
      */}
      <input type="hidden" name="themeId" value={selected?.themeId ?? ""} />
      <input type="hidden" name="themeVariantId" value={selected?.variantId ?? ""} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-fg-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={g.searchPlaceholder}
            aria-label={g.searchPlaceholder}
            className="h-11 w-full rounded-full border border-border bg-bg ps-10 pe-4 text-sm text-fg outline-none transition-colors focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
            hasFilters ? "border-accent bg-accent-soft/15 text-accent" : "border-border text-fg-muted hover:border-accent hover:text-accent"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {g.filterButton}
        </button>
      </div>

      {filtersOpen && (
        <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-border bg-surface-2/50 p-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{g.filterStyleLabel}</span>
            <div className="flex flex-wrap gap-2">
              {THEME_CATEGORIES.map((chip) => (
                <Chip
                  key={chip.key}
                  active={category === chip.key}
                  onClick={() => setCategory(chip.key)}
                  label={g[chip.dictKey]}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{g.filterColorLabel}</span>
            <div className="flex flex-wrap gap-2">
              <Chip active={color === null} onClick={() => setColor(null)} label={g.categoryAll} />
              {THEME_COLORS.map((opt) => (
                <Chip
                  key={opt.tag}
                  active={color === opt.tag}
                  onClick={() => setColor(opt.tag)}
                  label={g[opt.dictKey]}
                />
              ))}
            </div>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setColor(null);
              }}
              className="w-fit text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              {f.themeClearFilters}
            </button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-14 text-center text-sm text-fg-muted">{g.noResults}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((family) => {
            const shown = shownIn(family);
            const isSelected = shown.key === selectedKey;
            return (
              <div
                key={family.key}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-surface transition-colors ${
                  isSelected ? "border-accent ring-1 ring-accent" : "border-border hover:border-fg-muted"
                }`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={shown.variantName ? `${shown.name} — ${shown.variantName}` : shown.name}
                  onClick={() => setSelectedKey(shown.key)}
                  className="relative block w-full text-start"
                >
                  <span
                    className="relative block aspect-[3/2] w-full overflow-hidden"
                    style={{
                      background: shown.thumbnailUrl
                        ? undefined
                        : `linear-gradient(135deg, ${shown.config.palette.bg}, ${shown.config.palette.accent})`,
                    }}
                  >
                    {shown.thumbnailUrl && (
                      // Two columns on a phone, so each tile is about half a
                      // narrow viewport — a fraction of the source art's width.
                      <EnvelopeThumbnail
                        url={shown.thumbnailUrl}
                        cutout={shown.thumbnailCutout}
                        sizes="(max-width: 640px) 50vw, 220px"
                        tileAspect={3 / 2}
                      />
                    )}
                  </span>
                  {isSelected && (
                    <span className="absolute end-2 top-2 flex h-7 items-center gap-1 rounded-full bg-accent px-2.5 text-[11px] font-bold text-accent-fg shadow">
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                      {f.themeSelectedBadge}
                    </span>
                  )}
                </button>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div>
                    <p className="text-sm font-bold leading-tight text-fg">{family.name}</p>
                    {/* Which colour is on the tile, and how many more there
                        are — a design with one colour has neither to say, so
                        it names its style instead of "لون واحد". */}
                    <p className="mt-0.5 text-[11px] text-fg-muted">
                      {family.members.length > 1
                        ? [
                            shown.variantName ?? themeColorLabel(shown.colorTag, dict.themesGallery),
                            colorCountLabel(family.members.length, dict, nf),
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : themeCategoryLabel(family.category, dict.themesGallery)}
                    </p>
                  </div>

                  {family.members.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {family.members.map((member) => {
                        const swatch = member.config.palette.swatch ?? member.config.palette.accent;
                        const isShown = member.key === shown.key;
                        return (
                          <button
                            key={member.key}
                            type="button"
                            aria-label={member.variantName ?? themeColorLabel(member.colorTag, dict.themesGallery) ?? member.name}
                            aria-pressed={isShown}
                            // Touching a colour picks it: on a card the customer
                            // has already chosen, changing the swatch without
                            // changing the choice would silently send the old one.
                            onClick={() => {
                              setShownByFamily((prev) => ({ ...prev, [family.key]: member.key }));
                              setSelectedKey(member.key);
                            }}
                            className="h-5 w-5 rounded-full border border-border transition-transform hover:scale-110"
                            style={{
                              background: swatch,
                              outline: isShown ? "2px solid var(--color-accent)" : undefined,
                              outlineOffset: "1px",
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewKey(shown.key)}
                    className="mt-auto h-8 w-full rounded-full border border-border text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    {dict.admin.preview}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Under the grid, not in it: it is the answer to "none of these", which
          only means anything once the customer has looked at all of them. */}
      {allowCustomRequest && (
        <CustomDesignRequestFields
          locale={locale}
          dict={dict}
          choices={{
            colorTags: THEME_COLORS.map((c) => ({ tag: c.tag, label: g[c.dictKey] })),
            styles: THEME_CATEGORIES.filter((c) => c.dbValue !== null).map((c) => ({
              value: c.dbValue as string,
              label: g[c.dictKey],
            })),
            designs: families.map((family) => ({ id: family.members[0].themeId, name: family.name })),
          }}
        />
      )}

      {previewKey && previewFamily && (
        <ThemePreviewDialog
          key={previewKey}
          variants={previewFamily.members.map((m) => ({
            id: m.key,
            config: m.config,
            builder: m.builder,
          }))}
          initialVariantId={previewKey}
          themeCategory={previewFamily.category}
          dict={dict}
          hasQr={hasQr}
          open
          onOpenChange={(open) => !open && setPreviewKey(null)}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 rounded-full border px-3 text-xs transition-colors ${
        active
          ? "border-accent bg-accent font-medium text-accent-fg"
          : "border-border text-fg-muted hover:border-accent hover:text-accent"
      }`}
    >
      {label}
    </button>
  );
}
