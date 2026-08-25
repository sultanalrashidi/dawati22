"use client";

import { useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import type { BuilderTheme } from "@/components/guest/invitation-view";
import { ThemeGalleryCard } from "@/components/themes/theme-gallery-card";
import { ThemeGalleryFamilyCard } from "@/components/themes/theme-gallery-family-card";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";

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
};

const CATEGORY_CHIPS = [
  { key: "all", dictKey: "categoryAll", dbValue: null },
  { key: "luxury", dictKey: "categoryLuxury", dbValue: "luxury" },
  { key: "soft", dictKey: "categorySoft", dbValue: "soft" },
  { key: "modern", dictKey: "categoryModern", dbValue: "modern" },
  { key: "classic", dictKey: "categoryClassic", dbValue: "classic" },
  { key: "romantic", dictKey: "categoryRomantic", dbValue: "romantic" },
  { key: "simple", dictKey: "categorySimple", dbValue: "minimal" },
  { key: "dark", dictKey: "categoryDark", dbValue: "dark" },
  { key: "botanical", dictKey: "categoryBotanical", dbValue: "botanical" },
  { key: "experimental", dictKey: "categoryExperimental", dbValue: "experimental" },
  { key: "saudi", dictKey: "categorySaudi", dbValue: "saudi" },
] as const;

const COLOR_OPTIONS = [
  { dictKey: "colorWhite", tag: "أبيض" },
  { dictKey: "colorGold", tag: "ذهبي" },
  { dictKey: "colorBlack", tag: "أسود" },
  { dictKey: "colorBeige", tag: "بيج" },
  { dictKey: "colorPink", tag: "وردي" },
  { dictKey: "colorGreen", tag: "أخضر" },
  { dictKey: "colorNavy", tag: "كحلي" },
  { dictKey: "colorPurple", tag: "بنفسجي" },
  { dictKey: "colorBlue", tag: "أزرق" },
  { dictKey: "colorBrown", tag: "بني" },
  { dictKey: "colorMaroon", tag: "عنابي" },
] as const;

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

function categoryLabel(dbValue: string, dict: Dictionary) {
  const chip = CATEGORY_CHIPS.find((c) => c.dbValue === dbValue);
  return chip ? dict.themesGallery[chip.dictKey as keyof typeof dict.themesGallery] : dbValue;
}

export function ThemeGalleryGrid({
  themes,
  dict,
}: {
  themes: ThemeItem[];
  dict: Dictionary;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [sort, setSort] = useState<"default" | "newest" | "popular">("default");

  const families = useMemo(() => buildFamilies(themes), [themes]);
  const activeCategoryDbValue = CATEGORY_CHIPS.find((c) => c.key === category)?.dbValue ?? null;

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

  const previewMember = themes.find((t) => t.id === previewId);
  const previewFamily = previewId ? families.find((f) => f.members.some((m) => m.id === previewId)) : undefined;
  const g = dict.themesGallery;

  return (
    <div className="mt-12">
      <div className="mx-auto max-w-md">
        <div className="relative">
          <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-fg-muted">🔎</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={g.searchPlaceholder}
            className="h-12 w-full rounded-full border border-accent/30 bg-surface ps-11 pe-4 text-sm text-fg outline-none transition-colors focus:border-accent"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-full border border-accent/30 px-4 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          <span>⚙️</span>
          {g.filterButton}
        </button>
      </div>

      {filterOpen && (
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-start justify-center gap-8 rounded-2xl border border-accent/20 bg-surface p-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">{g.filterColorLabel}</span>
            <div className="flex max-w-xs flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={
                  color === null
                    ? "h-8 rounded-full border border-transparent bg-accent px-3 text-xs text-accent-fg transition-colors"
                    : "h-8 rounded-full border border-fg-muted/30 px-3 text-xs text-fg-muted transition-colors hover:border-accent hover:text-accent"
                }
              >
                {g.categoryAll}
              </button>
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.tag}
                  type="button"
                  onClick={() => setColor(opt.tag)}
                  className={
                    color === opt.tag
                      ? "h-8 rounded-full border border-transparent bg-accent px-3 text-xs text-accent-fg transition-colors"
                      : "h-8 rounded-full border border-fg-muted/30 px-3 text-xs text-fg-muted transition-colors hover:border-accent hover:text-accent"
                  }
                >
                  {g[opt.dictKey as keyof typeof g]}
                </button>
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
              {CATEGORY_CHIPS.map((chip) => (
                <option key={chip.key} value={chip.key}>
                  {g[chip.dictKey as keyof typeof g]}
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
          {sorted.map((family) => {
            const colorIndex = color ? family.members.findIndex((m) => m.config.colorTag === color) : -1;
            return family.members.length > 1 ? (
              <ThemeGalleryFamilyCard
                key={`${family.key}:${color ?? "all"}`}
                name={family.rep.name}
                categoryLabel={categoryLabel(family.rep.category, dict)}
                variants={family.members}
                dict={dict}
                onPreview={setPreviewId}
                initialSelectedIndex={colorIndex >= 0 ? colorIndex : 0}
              />
            ) : (
              <ThemeGalleryCard
                key={family.key}
                name={family.rep.name}
                category={categoryLabel(family.rep.category, dict)}
                config={family.rep.config}
                dict={dict}
                onPreview={() => setPreviewId(family.rep.id)}
              />
            );
          })}
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
