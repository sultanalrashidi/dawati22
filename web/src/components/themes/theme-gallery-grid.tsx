"use client";

import { useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { ThemeConfig } from "@/lib/themes/types";
import type { BuilderTheme } from "@/components/guest/invitation-view";
import { ThemeGalleryCard } from "@/components/themes/theme-gallery-card";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";
import {
  THEME_CATEGORIES,
  THEME_COLORS,
  themeCategoryLabel,
  themeColorLabel,
} from "@/lib/themes/vocabulary";

type ThemeItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  config: ThemeConfig;
  createdAt: string;
  eventCount: number;
  /** BUILDER themes only — their own layout/art, forwarded to the preview. */
  builder?: BuilderTheme;
  /** The design's own closed-envelope art, when it has any. */
  thumbnailUrl?: string;
};

function buildFamilies(themes: ThemeItem[]) {
  const groups = new Map<string, ThemeItem[]>();
  for (const t of themes) {
    const key = t.config.family ?? t.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return Array.from(groups.values()).map((members) => {
    const rep = members.find((m) => m.slug === m.config.family) ?? members[0];
    const createdAt = members.reduce((min, m) => (m.createdAt < min ? m.createdAt : min), members[0].createdAt);
    const eventCount = members.reduce((sum, m) => sum + m.eventCount, 0);
    const colorTags = members.map((m) => m.config.colorTag).filter((t): t is string => Boolean(t));
    return { key: rep.id, rep, members, createdAt, eventCount, colorTags };
  });
}

type Family = ReturnType<typeof buildFamilies>[number];

function colorCountLabel(n: number, dict: Dictionary, nf: Intl.NumberFormat) {
  const g = dict.themesGallery;
  if (n === 1) return undefined;
  if (n === 2) return g.colorCountTwo;
  if (n <= 10) return g.colorCountFew.replace("{n}", nf.format(n));
  return g.colorCountMany.replace("{n}", nf.format(n));
}

export function ThemeGalleryGrid({
  themes,
  dict,
  locale,
}: {
  themes: ThemeItem[];
  dict: Dictionary;
  locale: Locale;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [sort, setSort] = useState<"default" | "newest" | "popular">("default");
  /** Which colour of a design is on show, once a visitor has touched it. */
  const [shownByFamily, setShownByFamily] = useState<Record<string, string>>({});

  const families = useMemo(() => buildFamilies(themes), [themes]);
  // Arabic reads its own digits; English must not be forced into them.
  const nf = useMemo(
    () => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US"),
    [locale],
  );

  const activeCategoryDbValue = THEME_CATEGORIES.find((c) => c.key === category)?.dbValue ?? null;

  const filtered = families.filter((f) => {
    if (search.trim() && !f.rep.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (activeCategoryDbValue && f.rep.category !== activeCategoryDbValue) return false;
    if (color && !f.colorTags.includes(color)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "popular") return b.eventCount - a.eventCount;
    if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  /**
   * Derived rather than stored, so a card shows something sensible before it
   * has been touched: the colour being filtered for, then the family's own
   * representative.
   */
  function shownIn(family: Family): ThemeItem {
    const touched = family.members.find((m) => m.id === shownByFamily[family.key]);
    if (touched) return touched;
    if (color) {
      const match = family.members.find((m) => m.config.colorTag === color);
      if (match) return match;
    }
    return family.rep;
  }

  const previewMember = themes.find((t) => t.id === previewId);
  const previewFamily = previewId ? families.find((f) => f.members.some((m) => m.id === previewId)) : undefined;
  const g = dict.themesGallery;

  return (
    <div className="mt-12">
      <div className="mx-auto max-w-md">
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-fg-muted">
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
            className="h-12 w-full rounded-full border border-accent/30 bg-surface ps-11 pe-4 text-sm text-fg outline-none transition-colors focus:border-accent"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          className="flex h-9 items-center gap-2 rounded-full border border-accent/30 px-4 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {g.filterButton}
        </button>
      </div>

      {filterOpen && (
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-start justify-center gap-8 rounded-2xl border border-accent/20 bg-surface p-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{g.filterColorLabel}</span>
            <div className="flex max-w-xs flex-wrap gap-2">
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

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{g.filterStyleLabel}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-lg border border-accent/30 bg-transparent px-3 text-xs outline-none"
            >
              {THEME_CATEGORIES.map((chip) => (
                <option key={chip.key} value={chip.key}>
                  {g[chip.dictKey]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{g.filterSortLabel}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-9 rounded-lg border border-accent/30 bg-transparent px-3 text-xs outline-none"
            >
              <option value="default">{g.categoryAll}</option>
              <option value="newest">{g.sortNewest}</option>
              <option value="popular">{g.sortPopular}</option>
            </select>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-16 text-center text-sm text-fg-muted">{g.noResults}</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((family) => (
            <ThemeGalleryCard
              key={family.key}
              name={family.rep.name}
              categoryLabel={themeCategoryLabel(family.rep.category, dict.themesGallery)}
              colorCountLabel={colorCountLabel(family.members.length, dict, nf)}
              variants={family.members.map((m) => ({
                id: m.id,
                config: m.config,
                thumbnailUrl: m.thumbnailUrl,
                colorLabel: themeColorLabel(m.config.colorTag, dict.themesGallery),
              }))}
              shownId={shownIn(family).id}
              onShow={(id) => setShownByFamily((prev) => ({ ...prev, [family.key]: id }))}
              onPreview={setPreviewId}
              dict={dict}
            />
          ))}
        </div>
      )}

      {previewMember && previewFamily && (
        <ThemePreviewDialog
          key={previewMember.id}
          variants={previewFamily.members}
          initialVariantId={previewMember.id}
          themeCategory={previewMember.category}
          dict={dict}
          open={Boolean(previewMember)}
          onOpenChange={(open) => !open && setPreviewId(null)}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-8 rounded-full border border-transparent bg-accent px-3 text-xs text-accent-fg transition-colors"
          : "h-8 rounded-full border border-fg-muted/30 px-3 text-xs text-fg-muted transition-colors hover:border-accent hover:text-accent"
      }
    >
      {label}
    </button>
  );
}
