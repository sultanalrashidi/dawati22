import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/data/collection-standard.snapshot.json';
import { doveDesign } from '../src/lib/themes/builder/dove-velvet';
import { floralDesigns } from '../src/lib/themes/builder/floral-pair';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import { contrast } from '../src/lib/themes/builder/collection-standard';
import { applyJasmineStandard, jasmineReference, PASS_PLANS, type StandardDesign } from '../src/lib/themes/builder/jasmine-standard';
import type { Layer, LayoutDoc, TextLayer, VariantPalette } from '../src/lib/themes/builder/types';
import type { LayoutOverrides } from '../src/lib/themes/builder/resolve';

// The committed catalogue snapshot is older than production, which is fine
// here: these are properties any design must come out with, whatever it
// started from. The real write is generated from a fresh read of production.
type Entry = (typeof catalog)[number];
function read(raw: unknown, field: 'layout' | 'typography', depth = 0): unknown {
  if (typeof raw !== 'string') return raw;
  const match = /:themes:(\d+):builder:(layout|typography)$/.exec(raw);
  if (!match || depth > catalog.length) throw new Error('bad reference');
  return read((catalog[Number(match[1])] as Entry).builder[field], field, depth + 1);
}
const designs: StandardDesign[] = [
  ...[...new Set(catalog.map(e => e.config.family))].filter(f => PASS_PLANS[f]).map(family => {
    const entries = catalog.filter(e => e.config.family === family);
    return { family, layout: assertLayoutDoc(read(entries[0].builder.layout, 'layout')),
      variants: entries.map(e => ({ slug: e.slug, overrides: e.builder.overrides as LayoutOverrides, palette: e.builder.palette as VariantPalette })) };
  }),
  ...[doveDesign(), ...floralDesigns()].map(d => ({ family: d.family, layout: d.layout, variants: d.variants })),
];
const reference = jasmineReference().layout;
const texts = (doc: LayoutDoc, scene: string) => doc.layers.filter((l): l is TextLayer => l.scene === scene && l.type === 'text' && l.visible);
const edges = (l: Layer) => ({ top: l.base.y - (l.base.height ?? 0) / 2, bottom: l.base.y + (l.base.height ?? 0) / 2 });

test('the reference is عروس الياسمين with the seats-line typo mended', () => {
  const doc = assertLayoutDoc(structuredClone(reference));
  const count = doc.layers.find(l => l.id === 'rb_pass_count') as TextLayer;
  assert.equal(count.text, 'عدد المرافقين: {allowedCount}');
  assert.deepEqual(doc.scenes.map(s => s.id), ['cover', 'open', 'greeting', 'details', 'countdown', 'schedule', 'notes', 'rsvp', 'pass']);
});

test('every design comes out valid, in the reference order, with its artwork untouched', () => {
  assert.ok(designs.length >= 12);
  for (const design of designs) {
    const { layout } = applyJasmineStandard(design);
    assert.ok(assertLayoutDoc(structuredClone(layout)), design.family);
    assert.deepEqual(layout.scenes.map(s => s.id), reference.scenes.map(s => s.id), design.family);
    assert.deepEqual(layout.animation, reference.animation);
    // Art, seals' places and the QR are the design's own and do not move.
    for (const before of design.layout.layers.filter(l => l.type === 'asset' || l.type === 'qr')) {
      assert.deepEqual(layout.layers.find(l => l.id === before.id), before, `${design.family} ${before.id}`);
    }
    for (const scene of design.layout.scenes) {
      assert.deepEqual(layout.scenes.find(s => s.id === scene.id)?.canvas, scene.canvas, `${design.family} ${scene.id} canvas`);
    }
  }
});

test('every pass carries the reference lines once, the date block whole, and nothing on the QR', () => {
  for (const design of designs) {
    const { layout } = applyJasmineStandard(design);
    const plan = PASS_PLANS[design.family];
    const lines = texts(layout, 'pass');
    const bound = (field: string) => lines.filter(l => l.source === 'content' && l.fields.includes(field as never));
    const said = (words: string) => lines.filter(l => l.source === 'static' && l.text.includes(words));
    assert.equal(bound('coupleLine').length, 1, `${design.family} couple`);
    assert.equal(bound('guestName').length, 1, `${design.family} guest`);
    assert.equal(said('بمشيئة الله').length, 1, `${design.family} godwilling`);
    assert.equal(said('{allowedCount}').length, 1, `${design.family} seats`);
    assert.equal(said('بطاقة الدخول').length, plan.title === null ? 0 : 1, `${design.family} title`);
    const details = bound('eventDate');
    assert.equal(details.length, 1, `${design.family} date block`);
    assert.deepEqual(details[0].fields, ['eventDate', 'eventTime', 'locationFull']);
    assert.equal(bound('locationFull').length, 1, `${design.family} place only in the block`);
    const qr = layout.layers.find(l => l.scene === 'pass' && l.type === 'qr')!;
    for (const line of lines) {
      if (line.fields.includes('invitationText' as never)) continue;
      const box = edges(line), code = edges(qr);
      assert.ok(box.bottom <= code.top + 0.01 || box.top >= code.bottom - 0.01, `${design.family} ${line.id} sits on the QR`);
    }
    // Above the QR the lines follow the reference's reading order.
    const order = ['coupleLine', 'بمشيئة الله', 'eventDate', 'guestName', '{allowedCount}']
      .map(key => lines.find(l => l.fields.includes(key as never) || l.text.includes(key))!)
      .filter(l => edges(l).bottom <= edges(qr).top + 0.01)
      .map(l => l.base.y);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${design.family} reading order`);
  }
});

test('the open card says what the reference says', () => {
  const said = texts(reference, 'open').map(l => l.source === 'static' ? l.text : l.fields.join());
  for (const design of designs) {
    const lines = texts(applyJasmineStandard(design).layout, 'open').map(l => l.source === 'static' ? l.text : l.fields.join());
    for (const line of said) assert.ok(lines.includes(line), `${design.family} open: ${line}`);
  }
});

test('every seal shows the couple’s initials the way the reference does', () => {
  const seal = reference.layers.find(l => l.type === 'seal')!;
  for (const design of designs) {
    const mine = applyJasmineStandard(design).layout.layers.find(l => l.type === 'seal');
    assert.ok(mine?.type === 'seal' && seal.type === 'seal');
    assert.equal(mine.mode, seal.mode, design.family);
    assert.equal(mine.order, seal.order, design.family);
    assert.equal(mine.style.font, seal.style.font, design.family);
  }
});

test('a line added to a card that is inked per colour gets that colour’s ink', () => {
  const dove = designs.find(d => d.family === 'dove-velvet')!;
  const result = applyJasmineStandard(dove);
  const added = texts(result.layout, 'pass').find(l => l.source === 'static' && l.text.includes('بمشيئة الله'))!;
  assert.ok(!dove.layout.layers.some(l => l.id === added.id), 'the godwilling line is new on حمام الوصل');
  dove.variants.forEach((variant, i) => {
    const title = variant.overrides.dove_pass_title?.paint;
    if (title) assert.deepEqual(result.variants[i].overrides[added.id]?.paint, title, variant.slug);
  });
});

test('flow screens take the reference type but keep each design’s colours', () => {
  const host = reference.layers.find(l => l.id === 'f_greeting_host') as TextLayer;
  for (const design of designs) {
    const before = design.layout.layers.find(l => l.id === 'f_greeting_host') as TextLayer | undefined;
    const after = applyJasmineStandard(design).layout.layers.find(l => l.id === 'f_greeting_host') as TextLayer | undefined;
    if (!before || !after) continue;
    assert.equal(after.style.fontSize, host.style.fontSize, design.family);
    assert.equal(after.style.font, host.style.font, design.family);
    if (!before.style.color.startsWith('@')) assert.equal(after.style.color, before.style.color, design.family);
  }
});

test('a dark page gets light ink while its ivory cards keep the ink they had', () => {
  const layout = structuredClone(designs.find(d => d.family === 'floral-candles')!.layout);
  const palette: VariantPalette = { bg: '#0D251A', surface: '#F2EBDD', fg: '#183428', fgMuted: '#5D685F', accent: '#C5A166', accentFg: '#C5A166' };
  const result = applyJasmineStandard({ family: 'forest-green-flowers', layout, variants: [{ slug: 'forest', overrides: {}, palette }] });
  const next = result.variants[0].palette!;
  assert.ok(contrast(next.fg, palette.bg) >= 4.5 && contrast(next.fgMuted, palette.bg) >= 4.5);
  assert.ok(contrast(next.accentFg, next.accent) >= 4.5);
  for (const line of result.layout.layers.filter(l => (l.scene === 'open' || l.scene === 'pass') && l.type === 'text')) {
    const ink = (result.variants[0].overrides[line.id]?.paint as { style?: { color?: string } } | undefined)?.style?.color;
    assert.ok(ink && contrast(ink, palette.surface) >= 3, `${line.id} keeps a dark ink on the card`);
  }
});
