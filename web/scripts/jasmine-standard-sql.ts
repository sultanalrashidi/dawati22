import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

/**
 * Turns a proposal from build-jasmine-standard.ts into the SQL the owner runs
 * in the Neon console (production's credentials never leave Vercel).
 *
 *   npx tsx scripts/jasmine-standard-sql.ts <live-themes.json> <proposed-themes.json> <out.sql>
 *
 * Every row is backed up first, and every UPDATE is guarded on the value it
 * was built from: if anything moved in production since the live read, the
 * whole file stops with the list of what moved and writes nothing.
 */
type Theme = { themeId: string; family: string; name: string; layout: unknown;
  variants: { id: string; slug: string; name: string; overrides: Record<string, unknown>; palette: unknown }[] };

const [liveFile, proposedFile, out] = process.argv.slice(2);
if (!liveFile || !proposedFile || !out) throw new Error('usage: jasmine-standard-sql.ts <live> <proposed> <out.sql>');
const live = JSON.parse(readFileSync(liveFile, 'utf8')) as Theme[];
const proposed = JSON.parse(readFileSync(proposedFile, 'utf8')) as Theme[];

const literal = (value: unknown) => {
  const json = JSON.stringify(value);
  if (json.includes('$dw$')) throw new Error('document contains the quote tag');
  return `$dw$${json}$dw$::jsonb`;
};
const id = (value: string) => { if (!/^[\w-]+$/.test(value)) throw new Error(`unexpected id ${value}`); return `'${value}'`; };

const layouts: string[] = [], variants: string[] = [];
const themeIds: string[] = [], variantIds: string[] = [];
for (const next of proposed) {
  const before = live.find(t => t.themeId === next.themeId)!;
  if (!isDeepStrictEqual(before.layout, next.layout)) {
    themeIds.push(next.themeId);
    layouts.push(`  UPDATE "ThemeLayout" SET doc = ${literal(next.layout)}, "updatedAt" = now()
    WHERE "themeId" = ${id(next.themeId)} AND doc::jsonb = ${literal(before.layout)};
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN missed := missed || ${id(next.family)}::text; END IF;`);
  }
  for (const v of next.variants) {
    const old = before.variants.find(o => o.id === v.id)!;
    const overridesMoved = !isDeepStrictEqual(old.overrides ?? {}, v.overrides ?? {});
    const paletteMoved = !isDeepStrictEqual(old.palette, v.palette);
    if (!overridesMoved && !paletteMoved) continue;
    variantIds.push(v.id);
    // A palette changes only in the roles that move, each guarded on its old value.
    const was = old.palette as Record<string, string>, now = v.palette as Record<string, string>;
    const roles = Object.keys(now).filter(k => was[k] !== now[k]);
    const set = [overridesMoved && `"layoutOverrides" = ${literal(v.overrides)}`,
      paletteMoved && `palette = palette::jsonb || ${literal(Object.fromEntries(roles.map(k => [k, now[k]])))}`].filter(Boolean).join(', ');
    const guard = [`COALESCE("layoutOverrides", '{}'::jsonb)::jsonb = ${literal(old.overrides ?? {})}`,
      ...(paletteMoved ? roles.map(k => `palette::jsonb->>'${k.replace(/\W/g, '')}' = '${String(was[k]).replace(/[^#\w]/g, '')}'`) : [])].join(' AND ');
    variants.push(`  UPDATE "ThemeVariant" SET ${set}
    WHERE id = ${id(v.id)} AND ${guard};
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN missed := missed || ${id(v.slug)}::text; END IF;`);
  }
}

const sql = `-- دعوتي — كل التصاميم على نسق «عروس الياسمين»
-- ${new Date().toISOString().slice(0, 10)} · يُشغَّل بعد نشر الكود
--
-- بُني من التصاميم المنشورة كما هي الآن في www.dawati.store.
-- ${layouts.length} تصميم و${variants.length} لون.
-- يحفظ نسخة احتياطية أولًا في "JasmineStandardBackup20260913".
-- كل تعديل مشروط بالقيمة الحالية: لو تغيّر أي تصميم بعد إعداد الملف
-- يتوقف الملف كله ويذكر اسم التصميم، وما ينكتب شيء.

BEGIN;

CREATE TABLE IF NOT EXISTS "JasmineStandardBackup20260913" (
  kind text NOT NULL, ref text NOT NULL, doc jsonb,
  "takenAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, ref));
INSERT INTO "JasmineStandardBackup20260913" (kind, ref, doc)
  SELECT 'layout', "themeId", doc::jsonb FROM "ThemeLayout" WHERE "themeId" IN (${themeIds.map(id).join(', ')}) ON CONFLICT DO NOTHING;
INSERT INTO "JasmineStandardBackup20260913" (kind, ref, doc)
  SELECT 'variant', id, jsonb_build_object('layoutOverrides', COALESCE("layoutOverrides", '{}'::jsonb)::jsonb, 'palette', palette::jsonb)
  FROM "ThemeVariant" WHERE id IN (${variantIds.map(id).join(', ')}) ON CONFLICT DO NOTHING;

DO $body$
DECLARE
  missed text[] := '{}';
  n int;
BEGIN
${layouts.join('\n')}
${variants.join('\n')}
  IF array_length(missed, 1) > 0 THEN
    RAISE EXCEPTION 'تغيّر في الموقع بعد إعداد الملف، وما انكتب شيء: %', array_to_string(missed, '، ');
  END IF;
END
$body$;

COMMIT;

SELECT 'تم: ${layouts.length} تصميم و${variants.length} لون' AS "النتيجة";
`;
writeFileSync(out, sql);
console.log(`${layouts.length} layouts, ${variants.length} variants, ${(sql.length / 1024).toFixed(0)} KB → ${out}`);
