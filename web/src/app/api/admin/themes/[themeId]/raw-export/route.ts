import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/client";

/**
 * A restorable snapshot of one theme, exactly as the database holds it.
 *
 * The admin has "duplicate", which copies a theme INSIDE the system. That is
 * not a backup: it goes through the same readers and writers as everything
 * else, so it cannot prove what the bytes were before a save, and it gives
 * you nothing to compare against afterwards. Editing a PUBLISHED template
 * writes straight to the row every live invitation reads — there is no draft
 * layout — so the only honest safety net is the row itself, taken before.
 *
 * RAW means raw. `doc` and `palette` and `layoutOverrides` are returned as
 * stored, never through `parseLayoutDoc` or the palette schema: those readers
 * normalise, migrate and drop fields they do not recognise, so a snapshot
 * taken through them could restore something subtly different from what was
 * there. The point of this file is to be byte-comparable.
 *
 * `updatedAt` on the layout row is the revision the caller compares against
 * before writing: if it has moved since the export, someone else has saved
 * and the write must stop rather than overwrite them.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/admin/themes/[themeId]/raw-export">) {
  const user = await getSessionUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { themeId } = await params;

  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    include: {
      layout: true,
      typography: true,
      variants: { orderBy: { sortOrder: "asc" } },
      assets: true,
    },
  });
  if (!theme) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = {
    // What this file is and what it can be compared against.
    kind: "dawati.theme.raw-export",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: { id: user.id, name: user.name },

    theme: {
      id: theme.id,
      slug: theme.slug,
      version: theme.version,
      name: theme.name,
      nameAr: theme.nameAr,
      status: theme.status,
      engine: theme.engine,
      config: theme.config,
      updatedAt: theme.updatedAt,
    },

    // THE revision. A conditional write must require this to be unchanged.
    layout: theme.layout
      ? { id: theme.layout.id, themeId: theme.layout.themeId, doc: theme.layout.doc, updatedAt: theme.layout.updatedAt }
      : null,

    typography: theme.typography
      ? { id: theme.typography.id, themeId: theme.typography.themeId, doc: theme.typography.doc, updatedAt: theme.typography.updatedAt }
      : null,

    variants: theme.variants.map((variant) => ({
      id: variant.id,
      slug: variant.slug,
      name: variant.name,
      nameAr: variant.nameAr,
      colorTag: variant.colorTag,
      palette: variant.palette,
      layoutOverrides: variant.layoutOverrides,
      sortOrder: variant.sortOrder,
      isDefault: variant.isDefault,
      updatedAt: variant.updatedAt,
    })),

    // Manifest only — the images live in blob storage and are not rewritten
    // by a layout save, so their URLs are enough to detect a change.
    assets: theme.assets.map((asset) => ({
      id: asset.id,
      variantId: asset.variantId,
      slot: asset.slot,
      url: asset.url,
      blobPath: asset.blobPath,
    })),
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Downloaded, not rendered: this is a file to keep, and its name says
      // which theme and which moment it belongs to.
      "Content-Disposition": `attachment; filename="dawati-theme-${theme.slug}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
