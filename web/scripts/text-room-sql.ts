import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

/**
 * Turns a proposal from text-room.ts into the SQL the owner runs in the Neon
 * console (production's credentials never leave Vercel).
 *
 *   npx tsx scripts/text-room-sql.ts <live-themes.json> <proposed-themes.json> <out.sql>
 *
 * Only text-box heights change, so only layouts are written. Every layout is
 * backed up first, and every write is guarded on the value it was built from —
 * the layout and the overrides of each of its colours, since the room was
 * measured with each colour's own positions. If anything moved in production
 * since the live read, the whole file stops, names the design, and writes
 * nothing.
 */
type Layer = { id: string; scene: string; base: { height: number | null } };
type Theme = { themeId: string; family: string; name: string; layout: { layers: Layer[] };
  variants: { id: string; slug: string; overrides?: Record<string, unknown> }[] };

const [liveFile, proposedFile, out] = process.argv.slice(2);
if (!liveFile || !proposedFile || !out) throw new Error('usage: text-room-sql.ts <live> <proposed> <out.sql>');
const live = JSON.parse(readFileSync(liveFile, 'utf8')) as Theme[];
const proposed = JSON.parse(readFileSync(proposedFile, 'utf8')) as Theme[];

const literal = (value: unknown) => {
  const json = JSON.stringify(value);
  if (json.includes('$dw$')) throw new Error('document contains the quote tag');
  return `$dw$${json}$dw$::jsonb`;
};
const id = (value: string) => { if (!/^[\w-]+$/.test(value)) throw new Error(`unexpected id ${value}`); return `'${value}'`; };

const writes: string[] = [], themeIds: string[] = [];
let boxes = 0;
for (const next of proposed) {
  const before = live.find(t => t.themeId === next.themeId);
  if (!before) throw new Error(`${next.family} is not in the live read`);
  if (isDeepStrictEqual(before.layout, next.layout)) continue;
  // Nothing but heights may differ.
  const heightless = (doc: Theme['layout']) => ({ ...doc, layers: doc.layers.map(l => ({ ...l, base: { ...l.base, height: null } })) });
  if (!isDeepStrictEqual(heightless(before.layout), heightless(next.layout))) throw new Error(`${next.family}: more than heights changed`);
  const changed = next.layout.layers.filter((layer, i) => layer.base.height !== before.layout.layers[i].base.height);
  boxes += changed.length;
  themeIds.push(next.themeId);
  const colours = before.variants.map(v => `
    PERFORM 1 FROM "ThemeVariant" WHERE id = ${id(v.id)} AND COALESCE("layoutOverrides", '{}'::jsonb)::jsonb = ${literal(v.overrides ?? {})};
    IF NOT FOUND THEN missed := missed || ${id(v.slug)}::text; END IF;`).join('');
  writes.push(`  -- ${next.name} (${next.family}): ${changed.length} مربع — ${changed.map(l => l.id).join('، ')}${colours}
  UPDATE "ThemeLayout" SET doc = ${literal(next.layout)}, "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "themeId" = ${id(next.themeId)} AND doc::jsonb = ${literal(before.layout)};
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN missed := missed || ${id(next.family)}::text; END IF;`);
}

const sql = `-- دعوتي — مساحة كافية للكلام على الجوالات الصغيرة
-- ${new Date().toISOString().slice(0, 10)} · ${themeIds.length} تصميم، ${boxes} مربع نص
--
-- بُني من التصاميم المنشورة كما هي الآن في www.dawati.store.
-- يغيّر ارتفاع مربعات النص فقط: كل مربع يكبر حول وسطه، فالكلام يبقى في مكانه
-- ولا يوصل للسطر اللي فوقه أو تحته ولا للباركود. ما يتغيّر خط ولا مقاس ولا لون ولا صورة.
-- يحفظ نسخة احتياطية أولًا في "TextRoomBackup20260915".
-- كل تعديل مشروط بالقيمة الحالية: لو تغيّر أي تصميم أو أي لون بعد إعداد الملف
-- يتوقف الملف كله ويذكر اسمه، وما ينكتب شيء.

BEGIN;

CREATE TABLE IF NOT EXISTS "TextRoomBackup20260915" (
  "themeId" text PRIMARY KEY, doc jsonb NOT NULL, "takenAt" timestamptz NOT NULL DEFAULT now());
INSERT INTO "TextRoomBackup20260915" ("themeId", doc)
  SELECT "themeId", doc::jsonb FROM "ThemeLayout" WHERE "themeId" IN (${themeIds.map(id).join(', ')}) ON CONFLICT DO NOTHING;

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

SELECT 'تم: ${themeIds.length} تصميم، ${boxes} مربع نص' AS "النتيجة";

-- التراجع (عند الحاجة فقط، وقبل أي تعديل جديد على التصاميم):
-- UPDATE "ThemeLayout" l SET doc = b.doc, "updatedAt" = (now() AT TIME ZONE 'UTC') FROM "TextRoomBackup20260915" b WHERE l."themeId" = b."themeId";
`;
writeFileSync(out, sql);
console.log(`${themeIds.length} layouts, ${boxes} boxes, ${(sql.length / 1024).toFixed(0)} KB → ${out}`);
