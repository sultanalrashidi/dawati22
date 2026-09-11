import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { floralDesigns } from '../src/lib/themes/builder/floral-pair';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import { contrast } from '../src/lib/themes/builder/collection-standard';

test('both floral designs contain nine scenes, four complete colours, readable ink and editable blank seals', () => {
  const designs = floralDesigns();
  assert.equal(designs.length, 2);
  for (const design of designs) {
    const doc = assertLayoutDoc(design.layout);
    assert.equal(doc.scenes.length, 9);
    assert.equal(design.variants.length, 4);
    const seal = doc.layers.find(l => l.type === 'seal');
    assert.ok(seal?.type === 'seal' && seal.text === '' && !seal.locked);
    for (const v of design.variants) {
      for (const path of Object.values(v.assets)) assert.ok(existsSync(`public${path}`), path);
      assert.ok(contrast(v.palette.fg, v.palette.bg) >= 4.5);
      assert.ok(contrast(v.palette.accentFg, v.palette.accent) >= 4.5);
    }
    const qr = doc.layers.find(l => l.type === 'qr')!;
    for (const l of doc.layers.filter(l => l.scene === 'pass' && l.type === 'text')) {
      assert.ok(l.base.y + l.base.height! / 2 < qr.base.y - qr.base.height! / 2 || l.base.y - l.base.height! / 2 > qr.base.y + qr.base.height! / 2, l.id);
    }
    if (design.family === 'hibiscus-butterfly') {
      for (const l of doc.layers.filter(l => l.scene !== 'cover' && l.scene !== 'open')) {
        assert.ok(l.base.x - l.base.width / 2 >= 44, l.id);
        assert.ok(l.base.x + l.base.width / 2 <= 96, l.id);
      }
    }
  }
});

test('the details page stacks its boxes without overlap, inside the stage', () => {
  for (const design of floralDesigns()) {
    const boxes = design.layout.layers
      .filter(l => l.scene === 'details')
      .map(l => ({ id: l.id, top: l.base.y - l.base.height! / 2, bottom: l.base.y + l.base.height! / 2 }))
      .sort((a, b) => a.top - b.top);
    boxes.forEach((box, i) => {
      assert.ok(box.top >= 0 && box.bottom <= 100, `${design.family} ${box.id}`);
      if (i > 0) assert.ok(box.top >= boxes[i - 1].bottom - 0.001, `${design.family} ${box.id} overlaps ${boxes[i - 1].id}`);
    });
  }
});
