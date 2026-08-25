import "server-only";
import { prisma } from "@/lib/db/client";
import { ThemeEngine } from "@/generated/prisma/client";
import { parseLayoutDoc, parsePalette, parseTypographyDoc } from "@/lib/themes/builder/schema";
import { buildAssetMap, parseLayoutOverrides, type LayoutOverrides } from "@/lib/themes/builder/resolve";
import {
  DEFAULT_TYPOGRAPHY_DOC,
  type LayoutDoc,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";
import type { ThemeConfig } from "@/lib/themes/types";

/**
 * Server-side loading of a BUILDER theme.
 *
 * The guest page renders a builder theme by handing the stored documents to
 * `<ThemeStage>`; everything it needs — layout, typography, the chosen
 * variant's palette, that variant's slot→url map and its sparse layer
 * overrides — is assembled here in one query so the renderer stays a pure
 * function of its props.
 */
export interface GuestBuilderTheme {
  layout: LayoutDoc;
  typography: TypographyDoc;
  palette: VariantPalette;
  /** slot → image url, already resolved for the chosen variant. */
  assets: Record<string, string>;
  overrides: LayoutOverrides;
}

/**
 * The variant a guest sees when the event doesn't name one: the flagged
 * default, else the first in the admin's own ordering.
 */
export function pickDefaultVariant<T extends { isDefault: boolean; sortOrder: number }>(
  variants: T[],
): T | null {
  if (variants.length === 0) return null;
  return (
    variants.find((v) => v.isDefault) ??
    [...variants].sort((a, b) => a.sortOrder - b.sortOrder)[0] ??
    null
  );
}

/**
 * Everything `<ThemeStage>` needs for one theme, or `null` when the theme is
 * hand-coded (LEGACY) — in which case the caller keeps its existing path and
 * nothing about the legacy render changes.
 */
export async function loadBuilderTheme(
  themeId: string,
  /** The colour the customer chose at event creation, if any. */
  variantId?: string | null,
): Promise<GuestBuilderTheme | null> {
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: {
      engine: true,
      layout: { select: { doc: true } },
      typography: { select: { doc: true } },
      variants: {
        select: { id: true, isDefault: true, sortOrder: true, palette: true, layoutOverrides: true },
        orderBy: { sortOrder: "asc" },
      },
      assets: { select: { slot: true, url: true, variantId: true } },
    },
  });

  if (!theme || theme.engine !== ThemeEngine.BUILDER) return null;

  // The chosen colour wins, but only if it still belongs to this theme: an
  // admin can reassign an event to a different design, and a stale id pointing
  // at another theme's colour must fall back rather than render foreign art.
  const chosen = variantId ? theme.variants.find((v) => v.id === variantId) : undefined;
  const variant = chosen ?? pickDefaultVariant(theme.variants);

  // Every parser here is the lenient kind on purpose: a guest's invitation must
  // render even if one stored layer carries a stale field.
  return {
    layout: parseLayoutDoc(theme.layout?.doc),
    typography: parseTypographyDoc(theme.typography?.doc),
    palette: parsePalette(variant?.palette),
    assets: buildAssetMap(theme.assets, variant?.id ?? null),
    overrides: parseLayoutOverrides(variant?.layoutOverrides),
  };
}

/**
 * The same payload as `loadBuilderTheme`, but for many themes at once and for
 * EVERY variant rather than just the default.
 *
 * The gallery shows one card per colour and previews whichever swatch the
 * visitor clicks, so it needs each variant's own art — and it must not issue a
 * query per card.
 */
export async function loadBuilderThemesForGallery(
  themeIds: string[],
): Promise<Map<string, Map<string, GuestBuilderTheme>>> {
  const byTheme = new Map<string, Map<string, GuestBuilderTheme>>();
  if (themeIds.length === 0) return byTheme;

  const themes = await prisma.theme.findMany({
    where: { id: { in: themeIds }, engine: ThemeEngine.BUILDER },
    select: {
      id: true,
      layout: { select: { doc: true } },
      typography: { select: { doc: true } },
      variants: {
        select: { id: true, palette: true, layoutOverrides: true },
        orderBy: { sortOrder: "asc" },
      },
      assets: { select: { slot: true, url: true, variantId: true } },
    },
  });

  for (const theme of themes) {
    const layout = parseLayoutDoc(theme.layout?.doc);
    const typography = parseTypographyDoc(theme.typography?.doc);
    const perVariant = new Map<string, GuestBuilderTheme>();
    for (const variant of theme.variants) {
      perVariant.set(variant.id, {
        layout,
        typography,
        palette: parsePalette(variant.palette),
        assets: buildAssetMap(theme.assets, variant.id),
        overrides: parseLayoutOverrides(variant.layoutOverrides),
      });
    }
    byTheme.set(theme.id, perVariant);
  }

  return byTheme;
}

/**
 * A builder theme stores no `ThemeConfig`, but the gallery cards, the event
 * theme picker and the guest page's surrounding chrome all read one. Project a
 * variant's palette (and the theme's font roles) into that shape so those
 * consumers keep working unchanged — the three art screens themselves come
 * from `<ThemeStage>`, never from this object.
 */
export function builderThemeConfig(input: {
  palette: VariantPalette;
  typography?: TypographyDoc | null;
  /** Groups a builder theme's variants into one gallery card. */
  family?: string;
  colorTag?: string | null;
}): ThemeConfig {
  const roles = input.typography?.roles ?? DEFAULT_TYPOGRAPHY_DOC.roles;
  const fallback = DEFAULT_TYPOGRAPHY_DOC.roles;

  return {
    layout: "classic-center",
    palette: input.palette,
    fonts: {
      arabicDisplay: roles.display?.family ?? fallback.display.family,
      arabicBody: roles.body?.family ?? fallback.body.family,
      latinDisplay: roles.latin?.family ?? fallback.latin.family,
    },
    motion: { openStyle: "fade", reducedMotionFallback: "fade" },
    sections: { showCountdown: true, showMap: true, showRsvp: true },
    ...(input.family ? { family: input.family } : {}),
    ...(input.colorTag ? { colorTag: input.colorTag } : {}),
  };
}
