import { readFileSync, writeFileSync } from 'node:fs';
import { launchChrome, SETTLED } from './headless-chrome';

/**
 * Gives the text boxes of the published designs the room their text needs,
 * wherever the screen has room, and writes the result as a proposal for
 * text-room-sql.ts. Production is the source: the designs are read from the
 * public gallery, never from a local snapshot.
 *
 *   curl -sL https://www.dawati.store/ar/themes -o <dir>/themes.html
 *   node ../../dawati444/scripts/extract-public-theme-catalog.mjs <dir>/themes.html <dir>/catalog.json
 *   npx tsx scripts/text-room.ts read <dir>/catalog.json <dir>        → <dir>/live-themes.json
 *   TEXT_FIT_DIR=<dir> npx next dev -p 3057                            (another terminal)
 *   TEXT_FIT_URL=http://localhost:3057 npx tsx scripts/text-room.ts propose <dir>   → <dir>/proposed-themes.json
 *
 * The room is measured, not estimated: at the 390px reference width, headless
 * Chrome lays out every text of every screen, colour and design with the
 * sample content and with long names, a long venue and the widest date, and
 * reports how tall each text is at its own size and at the 14px floor.
 *
 * The rules, in the order they bind:
 *  - A box only grows, and grows around its own centre, so its text stays
 *    exactly where the designer put it.
 *  - It never reaches past the text of the lines above and below it, a QR and
 *    its quiet zone, a button or the edge of the screen.
 *  - It grows as far as its text needs at full size (so it is not shrunk) and
 *    at the floor with the long content (so it never scrolls), with 6% and a
 *    pixel to spare for platforms whose font metrics run taller.
 *  - A text that would wrap onto more lines at full size keeps its box: a date
 *    broken in two reads worse than the same date a little smaller.
 *  - Colours that move a layer are measured on their own, and the shared
 *    height is the one every colour has room for; a colour that sets the
 *    box's height itself keeps it.
 */

type Variant = { id: string; slug: string; overrides?: Record<string, { height?: number | null } | undefined> };
type Layer = { id: string; type: string; scene: string; visible: boolean; base: { height: number | null; rotation: number } };
type Theme = { themeId: string; family: string; name: string; layout: { layers: Layer[] }; variants: Variant[] };

type Box = { id: string; top: number; bottom: number; left: number; right: number; text?: true; atAuthored: number; atFloor: number;
  justify: string; linesFitted: number; linesAuthored: number };
type Stage = { design: string; scene: string; variants: string; height: number; layers: Box[] };

const [mode, ...args] = process.argv.slice(2);

if (mode === 'read') {
  // The gallery stores repeated documents once and points at them by path.
  const [catalogFile, dir] = args;
  type Entry = { themeId: string; themeVariantId: string; slug: string; name: string; config: { family: string; colorTag?: string };
    builder: Record<string, unknown> };
  const catalog = JSON.parse(readFileSync(catalogFile, 'utf8')) as Entry[];
  const resolve = (raw: unknown, field: string, depth = 0): unknown => {
    if (typeof raw !== 'string') return raw;
    const match = /:themes:(\d+):builder:(\w+)$/.exec(raw);
    if (!match || match[2] !== field || depth > catalog.length) throw new Error(`bad reference ${raw}`);
    return resolve(catalog[Number(match[1])].builder[field], field, depth + 1);
  };
  const themes: (Omit<Theme, 'layout'> & { layout: unknown; typography: unknown; variants: (Variant & { name: string; palette: unknown; assets: unknown })[] })[] = [];
  for (const entry of catalog) {
    const builder = Object.fromEntries(Object.entries(entry.builder).map(([key, value]) => [key, resolve(value, key)]));
    let theme = themes.find(t => t.themeId === entry.themeId);
    if (!theme) themes.push(theme = { themeId: entry.themeId, family: entry.config.family, name: entry.name, layout: builder.layout, typography: builder.typography, variants: [] });
    if (JSON.stringify(theme.layout) !== JSON.stringify(builder.layout)) throw new Error(`layout differs within ${entry.slug}`);
    theme.variants.push({ id: entry.themeVariantId, slug: entry.slug, name: entry.config.colorTag || 'الأساسي',
      palette: builder.palette, assets: builder.assets, overrides: (builder.overrides ?? {}) as Variant['overrides'] });
  }
  writeFileSync(`${dir}/live-themes.json`, JSON.stringify(themes, null, 1));
  console.log(themes.map(t => `${t.family} ${t.name}: ${t.variants.length} colours`).join('\n'));
} else if (mode === 'propose') {
  const [dir] = args;
  const base = process.env.TEXT_FIT_URL;
  if (!base) throw new Error('set TEXT_FIT_URL to the dev server started with TEXT_FIT_DIR=' + dir);
  const themes = JSON.parse(readFileSync(`${dir}/live-themes.json`, 'utf8')) as Theme[];
  measure(base).then(([sample, long]) => {
    const { proposed, grown, short } = propose(themes, sample, long);
    writeFileSync(`${dir}/proposed-themes.json`, JSON.stringify(proposed, null, 1));
    console.log(`${grown.length} boxes grow:\n${grown.join('\n')}\n\n${short.length} without all the room they want:\n${short.join('\n')}`);
  }, error => { console.error(error); process.exitCode = 1; });
} else {
  throw new Error('usage: text-room.ts read <catalog.json> <dir> | propose <dir>');
}

/** Every layer's box and every text's needs, at the reference width, for the sample and the long content. */
async function measure(base: string): Promise<[Stage[], Stage[]]> {
  const browser = await launchChrome();
  try {
    const runs: Stage[][] = [];
    for (const long of [false, true]) {
      const page = new URL('/ar/themes/text-fit-review', base);
      page.searchParams.set('reference', '1');
      if (long) page.searchParams.set('long', '1');
      await browser.open(page.href);
      await browser.evaluate(SETTLED);
      runs.push(await browser.evaluate<Stage[]>(`[...document.querySelectorAll('[data-stage]')].map(stage => {
        const s = stage.getBoundingClientRect();
        return { design: stage.dataset.design, scene: stage.dataset.scene, variants: stage.dataset.variants, height: s.height,
          layers: [...stage.querySelectorAll('[data-layer-id]')].map(el => {
            const r = el.getBoundingClientRect();
            const row = { id: el.getAttribute('data-layer-id'), top: r.top - s.top, bottom: r.bottom - s.top, left: r.left - s.left, right: r.right - s.left };
            const box = el.querySelector('[data-text-overflow]');
            if (!box) return row;
            const text = box.firstElementChild;
            // Lines as laid out: distinct line tops across the text's blocks.
            const lines = () => [...text.children].reduce((n, span) => {
              const range = document.createRange(); range.selectNodeContents(span);
              return n + new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
            }, 0);
            const authored = parseFloat(getComputedStyle(box).fontSize);
            const was = text.style.fontSize;
            const linesFitted = lines();
            text.style.fontSize = authored + 'px';
            const atAuthored = text.scrollHeight, linesAuthored = lines();
            text.style.fontSize = Math.min(authored, 14) + 'px';
            const atFloor = text.scrollHeight;
            text.style.fontSize = was;
            return { ...row, text: true, atAuthored, atFloor, linesFitted, linesAuthored, justify: getComputedStyle(box).justifyContent };
          }) };
      })`));
    }
    return [runs[0], runs[1]];
  } finally {
    await browser.close();
  }
}

/** 6% and a pixel over what Chrome measured, for platforms whose font metrics run taller. */
const pad = (px: number) => px * 1.06 + 1;
/** Clear space kept between one text and the next, in reference px. */
const GAP = 3;
/** The quiet zone round a QR is part of the QR: it is what a scanner reads. */
const QR_MARGIN = 4;

function propose(themes: Theme[], sample: Stage[], long: Stage[]) {
  const key = (s: Stage) => `${s.design}|${s.scene}|${s.variants}`;
  const longStages = new Map(long.map(s => [key(s), s]));
  const grown: string[] = [], short: string[] = [];

  // Where a neighbour's text sits: its box's centre (or edge), as tall as its
  // text at full size — with the long content, no taller than its box shows.
  const extent = (box: Box, isLong: boolean): [number, number] => {
    const height = isLong ? Math.min(box.atAuthored, box.bottom - box.top) : box.atAuthored;
    if (box.justify === 'flex-start') return [box.top, box.top + height];
    if (box.justify === 'flex-end') return [box.bottom - height, box.bottom];
    const centre = (box.top + box.bottom) / 2;
    return [centre - height / 2, centre + height / 2];
  };
  // How tall a centred box may become without reaching anything round it.
  const room = (stage: Stage, box: Box, isLong: boolean, types: Map<string, string>) => {
    const centre = (box.top + box.bottom) / 2, half = (box.bottom - box.top) / 2;
    let up = centre, down = stage.height - centre;
    for (const other of stage.layers) {
      const type = types.get(other.id);
      // The card and page artwork sit behind the text; they are not in its way.
      if (other.id === box.id || type === 'asset') continue;
      if (Math.min(other.right, box.right) - Math.max(other.left, box.left) <= 0.5) continue;
      let [top, bottom] = other.text ? extent(other, isLong) : [other.top, other.bottom];
      if (type === 'qr') { top -= QR_MARGIN; bottom += QR_MARGIN; }
      const gap = other.text ? GAP : 1;
      if (bottom <= centre) up = Math.min(up, centre - bottom - gap);
      else if (top >= centre) down = Math.min(down, top - centre - gap);
      else if (!other.text && top <= box.top && bottom >= box.bottom) continue; // text set inside a frame
      else { up = Math.min(up, half); down = Math.min(down, half); }
    }
    return 2 * Math.max(0, Math.min(up, down));
  };

  const proposed = themes.map(theme => {
    const layout = structuredClone(theme.layout);
    const types = new Map(layout.layers.map(l => [l.id, l.type]));
    for (const layer of layout.layers) {
      if (layer.type !== 'text' || !layer.visible || layer.base.height === null || layer.base.rotation !== 0) continue;
      let next = Infinity;
      const why = new Set<string>();
      for (const stage of sample.filter(s => s.design === theme.family && s.scene === layer.scene)) {
        const slugs = stage.variants.split(',');
        if (slugs.some(slug => theme.variants.find(v => v.slug === slug)?.overrides?.[layer.id]?.height != null)) continue;
        const s = stage.layers.find(l => l.id === layer.id);
        const longStage = longStages.get(key(stage));
        const l = longStage?.layers.find(x => x.id === layer.id);
        if (!s?.text || !l?.text || !longStage) continue;
        const height = s.bottom - s.top;
        if (s.justify !== 'center' || s.linesAuthored > s.linesFitted) {
          why.add(s.justify !== 'center' ? `kept: set to the ${s.justify} of its box` : `kept: full size wraps ${s.linesFitted} → ${s.linesAuthored} lines`);
          next = Math.min(next, height / stage.height * 100);
          continue;
        }
        const roomSample = room(stage, s, false, types);
        const roomLong = Math.min(roomSample, room(longStage, l, true, types));
        const best = Math.max(height, Math.min(roomSample, pad(s.atAuthored)), Math.min(roomLong, pad(l.atFloor)));
        next = Math.min(next, best / stage.height * 100);
        // What a guest would still see, with FittedText's one-pixel tolerance.
        if (best + 1 < s.atAuthored) why.add(`the sample shrinks to ${Math.round(best / s.atAuthored * 100)}%`);
        if (best + 1 < l.atFloor) why.add('a long venue or name still scrolls');
      }
      if (!Number.isFinite(next)) continue;
      const height = Math.floor(next * 100 + 1e-6) / 100;
      if (height > layer.base.height + 0.005) {
        grown.push(`${theme.family} · ${layer.scene} · ${layer.id}: ${layer.base.height} → ${height}`);
        layer.base = { ...layer.base, height };
      }
      if (why.size) short.push(`${theme.family} · ${layer.scene} · ${layer.id}: ${[...why].join('; ')}`);
    }
    return { ...theme, layout };
  });
  return { proposed, grown, short };
}
