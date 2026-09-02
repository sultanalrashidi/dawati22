/**
 * Undo of the v3 "palette colour roles" upgrade (see lib/themes/builder/ink-roles.ts).
 *
 * The upgrade rewrites every layer colour as `@fg` / `@fgMuted` / … and stamps
 * the layout v3. A build from BEFORE the upgrade cannot read those roles — its
 * schema only knows hex — so rolling the code back without rolling the
 * documents back would drop every coloured layer from every invitation.
 * Run this FIRST, then roll the deployment back.
 *
 * What it does, per BUILDER theme still at v3: every role in the shared
 * layout becomes the DEFAULT colour's palette value (the closest thing to the
 * ink the document carried before), the layout is stamped v2, and every role
 * in a variant's own paint becomes that variant's palette value. Literals are
 * untouched. Idempotent: a v2 document is skipped.
 *
 *   cd web
 *   DATABASE_URL="<production url>" npx tsx prisma/manual/revert-ink-roles.ts            # dry run
 *   DATABASE_URL="<production url>" npx tsx prisma/manual/revert-ink-roles.ts --apply    # write
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ThemeEngine, type Prisma } from "../../src/generated/prisma/client";

const TEXT_STYLE_KEYS = ["style", "tabletStyle", "desktopStyle", "titleStyle", "numberStyle", "labelStyle", "timeStyle", "itemStyle", "fieldStyle"];
const LAYER_COLOR_KEYS = ["background", "borderColor", "boxColor", "fgColor", "fieldBackground", "accent", "accentFg"];
const ROLES = ["fg", "fgMuted", "accent", "accentFg", "surface", "bg"] as const;
type Palette = Record<(typeof ROLES)[number], string>;

function literal(value: unknown, palette: Palette): { value: unknown; changed: boolean } {
  if (typeof value !== "string" || !value.startsWith("@")) return { value, changed: false };
  const role = value.slice(1) as (typeof ROLES)[number];
  return { value: palette[(ROLES as readonly string[]).includes(role) ? role : "fg"], changed: true };
}

/** A layer (or a paint patch shaped like one) with its roles resolved to hex. */
function delitteralise(source: Record<string, unknown>, palette: Palette): { out: Record<string, unknown>; changed: number } {
  const out = { ...source };
  let changed = 0;
  for (const key of LAYER_COLOR_KEYS) {
    const r = literal(out[key], palette);
    if (r.changed) { out[key] = r.value; changed += 1; }
  }
  for (const key of TEXT_STYLE_KEYS) {
    const style = out[key];
    if (!style || typeof style !== "object") continue;
    const r = literal((style as { color?: unknown }).color, palette);
    if (r.changed) { out[key] = { ...(style as object), color: r.value }; changed += 1; }
  }
  return { out, changed };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  const themes = await prisma.theme.findMany({
    where: { engine: ThemeEngine.BUILDER },
    select: {
      id: true, nameAr: true,
      layout: { select: { doc: true } },
      variants: { select: { id: true, nameAr: true, isDefault: true, sortOrder: true, palette: true, layoutOverrides: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  let touched = 0;
  for (const theme of themes) {
    const doc = theme.layout?.doc as { version?: number; layers?: Record<string, unknown>[] } | null;
    if (!doc || typeof doc.version !== "number" || doc.version < 3) continue;
    const fallback = theme.variants.find((v) => v.isDefault) ?? theme.variants[0];
    if (!fallback) continue;
    const defaultPalette = fallback.palette as Palette;

    let layoutChanges = 0;
    const layers = (doc.layers ?? []).map((layer) => { const r = delitteralise(layer, defaultPalette); layoutChanges += r.changed; return r.out; });
    const nextDoc = { ...doc, version: 2, layers };

    const variantWrites: { id: string; overrides: Record<string, unknown>; changes: number }[] = [];
    for (const variant of theme.variants) {
      const overrides = (variant.layoutOverrides ?? {}) as Record<string, { paint?: Record<string, unknown> } & Record<string, unknown>>;
      let changes = 0;
      const next: Record<string, unknown> = {};
      for (const [layerId, override] of Object.entries(overrides)) {
        if (!override?.paint) { next[layerId] = override; continue; }
        const r = delitteralise(override.paint, variant.palette as Palette);
        changes += r.changed;
        next[layerId] = { ...override, paint: r.out };
      }
      if (changes > 0) variantWrites.push({ id: variant.id, overrides: next, changes });
    }

    console.log(`${theme.nameAr}: layout v${doc.version} → v2, ${layoutChanges} roles→hex in the layout, ${variantWrites.map((w) => `${w.changes}`).join("+") || 0} in variant paint`);
    touched += 1;
    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      const moved = await tx.themeLayout.updateMany({
        where: { themeId: theme.id, doc: { path: ["version"], equals: doc.version } },
        data: { doc: nextDoc as unknown as Prisma.InputJsonValue },
      });
      if (moved.count === 0) { console.log(`  skipped ${theme.nameAr}: the document moved meanwhile`); return; }
      for (const w of variantWrites) {
        await tx.themeVariant.update({ where: { id: w.id }, data: { layoutOverrides: w.overrides as unknown as Prisma.InputJsonValue } });
      }
    });
  }
  console.log(apply ? `applied to ${touched} theme(s)` : `dry run: ${touched} theme(s) would change — add --apply to write`);
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exit(1); });
