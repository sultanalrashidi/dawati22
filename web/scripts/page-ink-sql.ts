import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pageInkFor } from '../src/lib/themes/builder/jasmine-standard';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import type { LayoutOverrides } from '../src/lib/themes/builder/resolve';
import type { VariantPalette } from '../src/lib/themes/builder/types';

/**
 * Gives every published colour the page ink jasmine-standard.ts decides for
 * it (`pageInkFor`: light on a dark page, darker on a mid-tone one) and writes
 * the SQL the owner runs in the Neon console. Colours already right are left
 * alone, so running it over the whole catalogue touches only what moved.
 *
 *   npx tsx scripts/page-ink-sql.ts <live-themes.json> <out-dir>
 *     → <out-dir>/proposed-themes.json (for /ar/themes/text-fit-review) and <out-dir>/page_ink_prod.sql
 *
 * <live-themes.json> comes from `scripts/text-room.ts read`. Every colour is
 * backed up first, and every write is guarded on the value it was built from
 * and on the design's layout, whose card lines decide which lines keep their
 * ink; if anything moved since the read, the whole file stops and writes nothing.
 */
type Variant = { id: string; slug: string; name: string; palette: VariantPalette; overrides?: LayoutOverrides };
type Theme = { themeId: string; family: string; name: string; layout: unknown; variants: Variant[] };

const [liveFile, dir] = process.argv.slice(2);
if (!liveFile || !dir) throw new Error('usage: page-ink-sql.ts <live-themes.json> <out-dir>');
const live = JSON.parse(readFileSync(liveFile, 'utf8')) as Theme[];

const literal = (value: unknown) => {
  const json = JSON.stringify(value);
  if (json.includes('$dw$')) throw new Error('document contains the quote tag');
  return `$dw$${json}$dw$::jsonb`;
};
const id = (value: string) => { if (!/^[\w-]+$/.test(value)) throw new Error(`unexpected id ${value}`); return `'${value}'`; };

const writes: string[] = [], changed: { theme: Theme; before: Variant; after: Variant }[] = [];
const proposed = live.map(theme => {
  const layout = assertLayoutDoc(theme.layout);
  const variants = theme.variants.map(before => {
    const next = pageInkFor(theme.family, layout, { ...before, overrides: before.overrides ?? {} });
    const after = { ...before, palette: next.palette!, overrides: next.overrides };
    if (!isDeepStrictEqual(before.palette, after.palette) || !isDeepStrictEqual(before.overrides ?? {}, after.overrides)) changed.push({ theme, before, after });
    return after;
  });
  return { ...theme, variants };
});

for (const theme of new Set(changed.map(c => c.theme))) {
  writes.push(`  -- ${theme.name} (${theme.family})
  PERFORM 1 FROM "ThemeLayout" WHERE "themeId" = ${id(theme.themeId)} AND doc::jsonb = ${literal(theme.layout)};
  IF NOT FOUND THEN missed := missed || ${id(theme.family)}::text; END IF;`);
  for (const { before, after } of changed.filter(c => c.theme === theme)) {
    const roles = (Object.keys(after.palette) as (keyof VariantPalette)[]).filter(k => before.palette[k] !== after.palette[k]);
    const kept = Object.keys(after.overrides ?? {}).filter(k => !isDeepStrictEqual(before.overrides?.[k], after.overrides?.[k]));
    writes.push(`  -- ${before.name}: ${roles.map(k => `${k} ${before.palette[k]} → ${after.palette[k]}`).join('، ')}${kept.length ? `؛ ${kept.length} سطر على البطاقات يحتفظ بلونه` : ''}
  UPDATE "ThemeVariant" SET palette = ${literal(after.palette)}, "layoutOverrides" = ${literal(after.overrides)}
    WHERE id = ${id(before.id)} AND palette::jsonb = ${literal(before.palette)} AND COALESCE("layoutOverrides", '{}'::jsonb)::jsonb = ${literal(before.overrides ?? {})};
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN missed := missed || ${id(before.slug)}::text; END IF;`);
  }
}

const ids = changed.map(c => id(c.before.id)).join(', ');
const sql = `-- دعوتي — لون الكلام على الصفحات حسب رسمة كل لون
-- ${new Date().toISOString().slice(0, 10)} · ${changed.length} لون
--
-- بُني من التصاميم المنشورة كما هي الآن في www.dawati.store.
-- الألوان اللي صفحتها غامقة: كلام الصفحات يصير فاتح، وكلام البطاقات والختم وحقول النموذج يبقى بلونه.
-- الألوان اللي صفحتها متوسطة: الكلام يغمق شوي لين ينقرأ.
-- يحفظ نسخة احتياطية أولًا في "PageInkBackup20260915".
-- كل تعديل مشروط بالقيمة الحالية: لو تغيّر أي لون أو التصميم بعد إعداد الملف
-- يتوقف الملف كله ويذكر اسمه، وما ينكتب شيء.

BEGIN;

CREATE TABLE IF NOT EXISTS "PageInkBackup20260915" (
  id text PRIMARY KEY, palette jsonb, "layoutOverrides" jsonb, "takenAt" timestamptz NOT NULL DEFAULT now());
INSERT INTO "PageInkBackup20260915" (id, palette, "layoutOverrides")
  SELECT id, palette::jsonb, "layoutOverrides"::jsonb FROM "ThemeVariant" WHERE id IN (${ids}) ON CONFLICT DO NOTHING;

DO $body$
DECLARE
  missed text[] := '{}';
  n int;
BEGIN
${writes.join('\n')}
  IF array_length(missed, 1) > 0 THEN
    RAISE EXCEPTION 'تغيّر في الموقع بعد إعداد الملف، وما انكتب شيء: %', array_to_string(missed, '، ');
  END IF;
END
$body$;

COMMIT;

SELECT 'تم: ${changed.length} لون' AS "النتيجة";

-- التراجع (عند الحاجة فقط، وقبل أي تعديل جديد على هذه الألوان):
-- UPDATE "ThemeVariant" v SET palette = b.palette, "layoutOverrides" = b."layoutOverrides" FROM "PageInkBackup20260915" b WHERE v.id = b.id;
`;
writeFileSync(`${dir}/proposed-themes.json`, JSON.stringify(proposed, null, 1));
writeFileSync(`${dir}/page_ink_prod.sql`, sql);
console.log(changed.map(c => `${c.theme.family} ${c.before.slug}`).join('\n'));
console.log(`${changed.length} colours, ${(sql.length / 1024).toFixed(0)} KB`);
