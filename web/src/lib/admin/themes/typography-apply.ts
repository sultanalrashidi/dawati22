import "server-only";
import { prisma } from "@/lib/db/client";
import { Prisma, ThemeEngine } from "@/generated/prisma/client";
import type { ThemeConfig } from "@/lib/themes/types";
import { parseTypographyDoc } from "@/lib/themes/builder/schema";
import {
  presetToLegacyFonts,
  presetToTypographyDoc,
  type TypographyPreset,
} from "@/lib/themes/typography-preset";

/**
 * Setting the house typeface across many designs at once.
 *
 * Worth being blunt about what this is: a bulk overwrite of a choice somebody
 * made per design, and there is no undo. The catalogue really does vary — a
 * dozen different font combinations across it — so the panel shows what is
 * there before the button is pressed, and the scope can be narrowed to one
 * style or a hand-picked set. The count returned is the honest answer to "what
 * did that just change".
 *
 * What it CANNOT touch, and the form says so: colour, which lives in `palette`
 * and is never read here; and text SIZE, which a hand-coded design keeps in its
 * components and a builder design keeps per text layer.
 */

export type ApplyScope =
  | { kind: "all" }
  /** Every design whose `category` matches — the gallery's style filter. */
  | { kind: "category"; category: string }
  | { kind: "themes"; themeIds: string[] };

function whereFor(scope: ApplyScope): Prisma.ThemeWhereInput {
  if (scope.kind === "category") return { category: scope.category };
  if (scope.kind === "themes") return { id: { in: scope.themeIds } };
  return {};
}

/** How many designs a scope covers, for the confirmation before writing. */
export function countThemesInScope(scope: ApplyScope): Promise<number> {
  return prisma.theme.count({ where: whereFor(scope) });
}

export interface FontCombination {
  display: string;
  body: string;
  latin: string;
  count: number;
}

/**
 * What the catalogue's typography looks like right now, grouped.
 *
 * This is the number that should make someone hesitate: it is the variety they
 * would be flattening. Read from both engines so the picture is the whole
 * catalogue and not the half that happens to use the builder.
 */
export async function summariseThemeFonts(): Promise<FontCombination[]> {
  const themes = await prisma.theme.findMany({
    select: { engine: true, config: true, typography: { select: { doc: true } } },
  });

  const groups = new Map<string, FontCombination>();
  for (const theme of themes) {
    let display: string;
    let body: string;
    let latin: string;

    if (theme.engine === ThemeEngine.BUILDER) {
      const roles = parseTypographyDoc(theme.typography?.doc).roles;
      display = roles.display?.family ?? "—";
      body = roles.body?.family ?? "—";
      latin = roles.latin?.family ?? "—";
    } else {
      const fonts = (theme.config as unknown as ThemeConfig).fonts;
      display = fonts?.arabicDisplay ?? "—";
      body = fonts?.arabicBody ?? "—";
      latin = fonts?.latinDisplay ?? "—";
    }

    const key = `${display}|${body}|${latin}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { display, body, latin, count: 1 });
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/**
 * Writes the preset onto every design in scope.
 *
 * The two engines are written differently because they genuinely store fonts
 * differently, and one of them cannot carry a weight at all — see
 * `presetToLegacyFonts`. Everything else in a design's config is preserved by
 * spreading it: a bulk font change must not quietly reset a layout, a palette
 * or a card style.
 */
export async function applyTypographyPreset(
  preset: TypographyPreset,
  scope: ApplyScope,
): Promise<{ updated: number }> {
  const themes = await prisma.theme.findMany({
    where: whereFor(scope),
    select: { id: true, engine: true, config: true },
  });
  if (themes.length === 0) return { updated: 0 };

  const doc = presetToTypographyDoc(preset);
  const fonts = presetToLegacyFonts(preset);

  const writes = themes.map((theme) => {
    if (theme.engine === ThemeEngine.BUILDER) {
      return prisma.themeTypography.upsert({
        where: { themeId: theme.id },
        create: { themeId: theme.id, doc: doc as unknown as Prisma.InputJsonValue },
        update: { doc: doc as unknown as Prisma.InputJsonValue },
      });
    }
    const config = theme.config as unknown as ThemeConfig;
    return prisma.theme.update({
      where: { id: theme.id },
      data: {
        config: { ...config, fonts } as unknown as Prisma.InputJsonValue,
      },
    });
  });

  // One transaction: a half-applied house typeface is worse than none, because
  // nobody can tell by looking which designs took it.
  await prisma.$transaction(writes);
  return { updated: themes.length };
}
