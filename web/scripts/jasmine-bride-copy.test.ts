import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { jasmineBrideCopyDesign } from '../src/lib/themes/builder/jasmine-bride-copy';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import { contrast } from '../src/lib/themes/builder/collection-standard';

const hash = (path: string) => createHash('sha1').update(readFileSync(`public${path}`)).digest('hex');

test('nine complete colours on the live Jasmine Bride layout', () => {
  const design = jasmineBrideCopyDesign();
  const doc = assertLayoutDoc(design.layout);
  assert.equal(doc.scenes.length, 9);
  assert.equal(design.variants.length, 9);
  assert.equal(new Set(design.variants.map(v => v.slug)).size, 9);
  const ids = new Set(doc.layers.map(l => l.id));
  assert.ok(doc.layers.some(l => l.type === 'seal' && l.scene === 'cover'), 'monogram seal');
  assert.ok(doc.layers.some(l => l.type === 'qr' && l.scene === 'pass'), 'entry-pass QR');
  for (const v of design.variants) {
    for (const path of Object.values(v.assets)) assert.ok(existsSync(`public${path}`), path);
    // A NO_QR event swaps in cardNoQr; if it were the card itself, the
    // printed QR frame would stand empty on the pass.
    assert.notEqual(hash(v.assets.card), hash(v.assets.cardNoQr), `${v.slug} cardNoQr`);
    assert.ok(contrast(v.palette.fg, v.palette.bg) >= 4.5, `${v.slug} fg`);
    assert.ok(contrast(v.palette.fgMuted, v.palette.bg) >= 4.5, `${v.slug} fgMuted`);
    assert.ok(contrast(v.palette.accentFg, v.palette.accent) >= 4.5, `${v.slug} accentFg`);
    for (const id of Object.keys(v.overrides)) assert.ok(ids.has(id), `${v.slug} overrides unknown layer ${id}`);
  }
});
