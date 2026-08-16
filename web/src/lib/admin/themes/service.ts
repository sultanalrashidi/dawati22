import "server-only";
import { prisma } from "@/lib/db/client";
import { ThemeStatus } from "@/generated/prisma/client";
import type { ThemeConfig } from "@/lib/themes/types";

export class ThemeAdminError extends Error {}

export interface ThemeInput {
  slug: string;
  name: string;
  nameAr: string;
  category: string;
  description?: string;
  descriptionAr?: string;
  config: ThemeConfig;
}

export async function listAllThemes() {
  return prisma.theme.findMany({
    include: { assets: true, _count: { select: { events: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getThemeForEdit(themeId: string) {
  return prisma.theme.findUnique({
    where: { id: themeId },
    include: { assets: true, _count: { select: { events: true } } },
  });
}

export async function createTheme(actorId: string, input: ThemeInput) {
  const existing = await prisma.theme.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ThemeAdminError("A theme with this slug already exists");

  return prisma.theme.create({
    data: {
      ...input,
      config: input.config as unknown as object,
      status: ThemeStatus.DRAFT,
      createdById: actorId,
    },
  });
}

export async function duplicateTheme(actorId: string, themeId: string) {
  const source = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!source) throw new ThemeAdminError("Theme not found");

  let slug = `${source.slug}-copy`;
  let n = 2;
  while (await prisma.theme.findUnique({ where: { slug } })) {
    slug = `${source.slug}-copy-${n}`;
    n += 1;
  }

  return prisma.theme.create({
    data: {
      slug,
      name: `${source.name} (copy)`,
      nameAr: `${source.nameAr} (نسخة)`,
      category: source.category,
      description: source.description,
      descriptionAr: source.descriptionAr,
      config: source.config as object,
      status: ThemeStatus.DRAFT,
      createdById: actorId,
    },
  });
}

/**
 * Versioning-safe update: if the theme is already used by any event, editing
 * it must not change what those guests see. We fork a new row (new id/slug,
 * version+1) for the edit and archive the original instead of mutating it —
 * existing events keep pointing at the untouched original.
 */
export async function updateTheme(actorId: string, themeId: string, input: ThemeInput) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId }, include: { _count: { select: { events: true } } } });
  if (!theme) throw new ThemeAdminError("Theme not found");

  const inUse = theme._count.events > 0;

  if (!inUse) {
    if (input.slug !== theme.slug) {
      const collision = await prisma.theme.findUnique({ where: { slug: input.slug } });
      if (collision) throw new ThemeAdminError("A theme with this slug already exists");
    }
    return prisma.theme.update({
      where: { id: themeId },
      data: { ...input, config: input.config as unknown as object, updatedById: actorId },
    });
  }

  let forkedSlug = `${theme.slug}-v${theme.version + 1}`;
  let n = 2;
  while (await prisma.theme.findUnique({ where: { slug: forkedSlug } })) {
    forkedSlug = `${theme.slug}-v${theme.version + 1}-${n}`;
    n += 1;
  }

  const [, forked] = await prisma.$transaction([
    prisma.theme.update({ where: { id: themeId }, data: { status: ThemeStatus.ARCHIVED } }),
    prisma.theme.create({
      data: {
        ...input,
        slug: forkedSlug,
        version: theme.version + 1,
        config: input.config as unknown as object,
        status: theme.status === ThemeStatus.PUBLISHED ? ThemeStatus.PUBLISHED : ThemeStatus.DRAFT,
        createdById: theme.createdById,
        updatedById: actorId,
      },
    }),
  ]);

  return forked;
}

export async function setThemeStatus(themeId: string, status: ThemeStatus) {
  await prisma.theme.update({
    where: { id: themeId },
    data: { status, archivedAt: status === ThemeStatus.ARCHIVED ? new Date() : null },
  });
}

export async function deleteTheme(themeId: string) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId }, include: { _count: { select: { events: true, clientAssignments: true } } } });
  if (!theme) throw new ThemeAdminError("Theme not found");
  if (theme._count.events > 0) throw new ThemeAdminError("Theme is used by existing events and cannot be deleted");
  if (theme._count.clientAssignments > 0) throw new ThemeAdminError("Theme is assigned to a client and cannot be deleted");

  await prisma.theme.delete({ where: { id: themeId } });
}

export async function addThemeAsset(
  themeId: string,
  input: { kind: string; url: string; mimeType: string; fileSize: number; width?: number; height?: number }
) {
  return prisma.themeAsset.create({ data: { themeId, ...input } });
}

export async function removeThemeAsset(assetId: string) {
  await prisma.themeAsset.delete({ where: { id: assetId } });
}

export async function assignThemeToEvent(themeId: string, eventId: string, assignedById: string) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) throw new ThemeAdminError("Theme not found");

  await prisma.$transaction([
    prisma.clientAssignedTheme.deleteMany({ where: { eventId } }),
    prisma.clientAssignedTheme.create({ data: { themeId, eventId, assignedById } }),
    prisma.event.update({ where: { id: eventId }, data: { themeId } }),
  ]);
}
