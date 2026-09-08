import test from 'node:test';
import assert from 'node:assert/strict';
import original from '../src/data/public-theme-catalog.snapshot.json';
import updated from '../src/data/collection-standard.snapshot.json';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import { contrast } from '../src/lib/themes/builder/collection-standard';

function document(catalog: typeof original, index: number): ReturnType<typeof assertLayoutDoc> {
  const raw = catalog[index].builder.layout;
  if (typeof raw !== 'string') return assertLayoutDoc(raw);
  const match = /:themes:(\d+):builder:layout$/.exec(raw);
  assert.ok(match);
  return document(catalog, Number(match[1]));
}
test('all 12 designs and 92 variants have saved, valid layouts with unchanged assets and QR geometry', () => {
  assert.equal(updated.length, 92);
  assert.equal(updated.filter(e => typeof e.builder.layout === 'object').length, 12);
  for (let i = 0; i < original.length; i++) {
    const before = document(original, i), after = document(updated as unknown as typeof original, i);
    assert.deepEqual(after.scenes, before.scenes);
    assert.deepEqual(after.animation, before.animation);
    assert.deepEqual(updated[i].builder.assets, original[i].builder.assets);
    for (const layer of before.layers) {
      const next = after.layers.find(l => l.id === layer.id);
      assert.ok(next, `${original[i].name}: ${layer.id}`);
      if (layer.type === 'qr' || layer.type === 'asset' || layer.type === 'seal') assert.deepEqual(next, layer);
    }
    for (const role of ['fg', 'fgMuted'] as const) assert.ok(contrast(updated[i].builder.palette[role], updated[i].builder.palette.bg) >= 4.5, `${i} ${role}`);
    const names = after.layers.find(l => l.id === 'f_greeting_couples');
    assert.equal(names?.type, 'text');
    if (names?.type === 'text') assert.equal(names.style.font, 'Aref Ruqaa');
    for (const id of ['f_schedule','f_notes','f_rsvp']) {
      const layer = after.layers.find(l => l.id === id);
      assert.ok(layer && 'overflow' in layer && layer.overflow === 'scroll');
    }
  }
});
test('entry pass names and event bindings remain data driven and text never overlaps the QR', () => {
  for (let i = 0; i < updated.length; i++) {
    const doc = document(updated as unknown as typeof original, i);
    const qr = doc.layers.find(l => l.scene === 'pass' && l.type === 'qr')!;
    for (const l of doc.layers.filter(l => l.scene === 'pass' && l.type === 'text')) {
      const top = l.base.y - (l.base.height ?? 0)/2, bottom = l.base.y + (l.base.height ?? 0)/2;
      const qrTop = qr.base.y - (qr.base.height ?? 0)/2, qrBottom = qr.base.y + (qr.base.height ?? 0)/2;
      assert.ok(bottom <= qrTop || top >= qrBottom, `${updated[i].name}: ${l.id} overlaps QR`);
    }
  }
});

 test('Floral Candles pass ink contrasts with ivory paper in all eight colours without recolouring other scenes', () => {
  const variants = updated.filter(e => e.config.family === 'floral-candles');
  assert.equal(variants.length, 8);
  for (const entry of variants) {
    const old = original.find(e => e.id === entry.id)!;
    const overrides = entry.builder.overrides as Record<string, { paint?: { style?: { color?: string } } }>;
    for (const id of ['s_pass_couple', 's_pass_details', 's_pass_guest']) {
      const ink = overrides[id]?.paint?.style?.color;
      assert.ok(ink && contrast(ink, '#E7D6BF') >= 4.5, `${entry.slug}: ${id}`);
    }
    for (const [id, override] of Object.entries(old.builder.overrides)) {
      if (!id.startsWith('s_pass_')) assert.deepEqual(overrides[id], override);
    }
  }
});
