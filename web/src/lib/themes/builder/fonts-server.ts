import "server-only";
import { prisma } from "@/lib/db/client";
import { googleFontsHref, isBuiltinFont } from "@/lib/themes/font-registry";
import { FONT_ROLE_PREFIX, type LayoutDoc, type TypographyDoc } from "@/lib/themes/builder/types";

/**
 * Stylesheet URL for the admin-added fonts a theme actually uses.
 *
 * Built-in families arrive through `next/font` on every page already. Families
 * an admin added from the panel do not exist at build time, so without this the
 * design would silently render in the fallback face — the font would be
 * selectable in the editor and wrong on the guest's screen. Only the families
 * this theme references are requested, so adding a font to the library costs
 * nothing to themes that don't use it.
 */
export async function builderFontStylesheetHref(
  layout: LayoutDoc,
  typography: TypographyDoc,
): Promise<string | null> {
  const families = new Set<string>();

  // Roles resolve to a real family; layers may also name one directly.
  for (const role of Object.values(typography.roles)) {
    if (role?.family) families.add(role.family);
  }
  for (const layer of layout.layers) {
    if (layer.type !== "text" && layer.type !== "seal") continue;
    for (const style of [layer.style, layer.tabletStyle, layer.desktopStyle]) {
      const font = style?.font;
      if (font && !font.startsWith(FONT_ROLE_PREFIX)) families.add(font);
    }
  }

  const custom = [...families].filter((family) => !isBuiltinFont(family));
  if (custom.length === 0) return null;

  const rows = await prisma.themeFont.findMany({
    where: { family: { in: custom }, isActive: true },
    select: { family: true, weights: true },
  });
  if (rows.length === 0) return null;

  return googleFontsHref(rows);
}
