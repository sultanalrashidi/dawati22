import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { doveDesign } from '../src/lib/themes/builder/dove-velvet';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import { resolveScene } from '../src/lib/themes/builder/resolve';
import { contrast } from '../src/lib/themes/builder/collection-standard';

test('six complete colour variants with nine valid scenes and real asset files', () => {
  const design = doveDesign();
  assert.equal(design.variants.length, 6);
  assert.equal(assertLayoutDoc(design.layout).scenes.length, 9);
  for (const v of design.variants) {
    for (const path of Object.values(v.assets)) assert.ok(existsSync(`public${path}`), path);
    assert.ok(contrast(v.palette.fg, v.palette.bg) >= 4.5);
    for (const id of ['open', 'pass']) {
      for (const { layer } of resolveScene(design.layout, id, 'base', v.overrides, v.palette)) {
        if (layer.type === 'text') assert.ok(contrast(layer.style.color, '#F7F0E7') >= 4.5);
      }
    }
  }
});
test('entry-pass text leaves a clear square QR area and customer data stays bound', () => {
  const doc = doveDesign().layout;
  const qr = doc.layers.find(l => l.id === 'dove_pass_qr')!;
  for (const l of doc.layers.filter(l => l.scene === 'pass' && l.type === 'text')) {
    assert.ok(l.base.y + l.base.height! / 2 < qr.base.y - qr.base.height! / 2 || l.base.y - l.base.height! / 2 > qr.base.y + qr.base.height! / 2, l.id);
  }
  const guest = doc.layers.find(l => l.id === 'dove_pass_guest');
  assert.ok(guest?.type === 'text' && guest.fields.includes('guestName'));
});

test('envelope silhouettes survive validation and the seal starts blank and editable', () => {
  const doc = assertLayoutDoc(doveDesign().layout);
  for (const scene of ['cover', 'open']) {
    const asset = doc.layers.find(l => l.scene === scene && l.type === 'asset');
    assert.ok(asset?.type === 'asset' && asset.clipPolygon && asset.clipPolygon.length >= 4);
    assert.ok(asset.clipPolygon.every(p => p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100));
  }
  const seal = doc.layers.find(l => l.type === 'seal');
  assert.ok(seal?.type === 'seal' && seal.mode === 'static' && seal.text === '' && !seal.locked);
});
