/**
 * The words the catalogue is described with: visual styles and colour families.
 *
 * One list, imported by the public gallery, the event form's picker and the
 * custom-design brief. They are three views of the same catalogue, and a
 * customer who narrowed the gallery to "رومانسي" must find that word meaning
 * the same set of designs everywhere else — which stops being true the moment
 * there are two copies of this and only one of them gets a new category.
 *
 * `dictKey` indexes `dict.themesGallery`; `dbValue`/`tag` are what the database
 * actually stores. Free of `server-only` and of any import: both client
 * components and server pages read it.
 */

/**
 * One entry per category that a published theme actually uses. `soft` and
 * `modern` used to be listed and matched nothing, so both could only ever
 * return an empty gallery — a filter that can only fail is worse than none.
 */
export const THEME_CATEGORIES = [
  { key: "all", dictKey: "categoryAll", dbValue: null },
  { key: "luxury", dictKey: "categoryLuxury", dbValue: "luxury" },
  { key: "classic", dictKey: "categoryClassic", dbValue: "classic" },
  { key: "romantic", dictKey: "categoryRomantic", dbValue: "romantic" },
  { key: "simple", dictKey: "categorySimple", dbValue: "minimal" },
  { key: "dark", dictKey: "categoryDark", dbValue: "dark" },
  { key: "botanical", dictKey: "categoryBotanical", dbValue: "botanical" },
  { key: "experimental", dictKey: "categoryExperimental", dbValue: "experimental" },
  { key: "saudi", dictKey: "categorySaudi", dbValue: "saudi" },
] as const;

/** `tag` is stored on the theme as an Arabic word, so it is a key, not a label. */
export const THEME_COLORS = [
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

/** The dictionary section every key above indexes into. */
type GalleryDict = Record<string, string>;

export function themeCategoryLabel(dbValue: string, gallery: GalleryDict): string {
  const chip = THEME_CATEGORIES.find((c) => c.dbValue === dbValue);
  return chip ? gallery[chip.dictKey] : dbValue;
}

export function themeColorLabel(tag: string | undefined, gallery: GalleryDict): string | undefined {
  if (!tag) return undefined;
  const option = THEME_COLORS.find((c) => c.tag === tag);
  return option ? gallery[option.dictKey] : tag;
}
