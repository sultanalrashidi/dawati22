import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { isStrictLayoutDoc } from "@/lib/themes/builder/schema";
import { adoptPaletteRoles, needsInkRoles, type InkVariant } from "@/lib/themes/builder/ink-roles";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";
import type { LayoutDoc } from "@/lib/themes/builder/types";

/**
 * Bring one theme's stored ink up to v3 — on first read, then never again.
 *
 * The upgrade needs the variants' palettes, which is why it cannot live in
 * `parseLayoutDoc` with the other document upgrades: it runs here, from the
 * loaders that already hold layout and variants together. The result is
 * written back at once so the guest page, the gallery and the editor all read
 * the same document afterwards. The write is conditional on the stored
 * document still being at the version this request read, so a theme is
 * touched exactly once: a concurrent first read finds the row already moved
 * and writes nothing, and so does a read that overlaps an admin's own save.
 *
 * Two things are never written back: a document `parseLayoutDoc` had to
 * salvage (persisting it would make the layers it dropped permanent — see
 * `rawDoc`), and an upgrade that changed nothing (a read must not create
 * rows). Both are still SERVED upgraded, so the colours are right either way.
 *
 * A failed write is logged and the upgraded document is served anyway: a
 * guest's invitation must render in the right colours even if the database is
 * briefly read-only, and the next read simply tries again.
 */
export async function ensureInkRoles(
  themeId: string,
  /** The stored `ThemeLayout.doc`, before parsing — decides whether writing back is safe. */
  rawDoc: unknown,
  layout: LayoutDoc,
  variants: InkVariant[],
): Promise<{ layout: LayoutDoc; overrides: Map<string, LayoutOverrides> }> {
  if (!needsInkRoles(layout)) return { layout, overrides: new Map() };

  const upgrade = adoptPaletteRoles(layout, variants);
  if (upgrade.changes.length === 0 || !isStrictLayoutDoc(rawDoc)) {
    return { layout: upgrade.layout, overrides: upgrade.overrides };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.themeLayout.updateMany({
        // Only the document this request read: another writer got here first
        // if the version has already moved on.
        where: { themeId, doc: { path: ["version"], equals: layout.version } },
        data: { doc: upgrade.layout as unknown as Prisma.InputJsonValue },
      });
      if (moved.count === 0) return;
      for (const [variantId, overrides] of upgrade.overrides) {
        await tx.themeVariant.update({
          where: { id: variantId },
          data: { layoutOverrides: overrides as unknown as Prisma.InputJsonValue },
        });
      }
    });
  } catch (error) {
    console.error(`[ink-roles] could not persist the v3 upgrade of theme ${themeId}`, error);
  }

  return { layout: upgrade.layout, overrides: upgrade.overrides };
}
