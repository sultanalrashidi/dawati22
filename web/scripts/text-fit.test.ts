import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIT_FLOOR, fittedFloor } from '../src/lib/themes/builder/text-fit';
import { GUEST_PHONES, guestStageWidth, STAGE_RESERVE, stageKindFor, stageMaxWidth } from '../src/lib/themes/builder/stage-size';

const REFERENCE = 390;
const FLOW = { aspectW: 390, aspectH: 620, safeInset: 6 };
const RIBBON_PASS = { aspectW: 900, aspectH: 1700, safeInset: 6 };
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the fitted floor is 14px on the 390px stage and shrinks with a narrower one', () => {
  // At the reference width and wider, exactly the old rule.
  for (const [authored, reference] of [[19, 19], [20.27, 19], [12, 12], [30, 24]]) {
    assert.equal(fittedFloor(authored, reference), Math.min(authored, FIT_FLOOR));
  }
  // Narrower, the floor is what 14px on the designer's stage becomes, so a box
  // that fits in the editor fits on every phone.
  for (const width of [188, 245, 280, 310, 342, 364]) {
    const scale = width / REFERENCE;
    for (const reference of [13, 16, 19, 24, 40]) {
      const floor = fittedFloor(reference * scale, reference);
      assert.ok(Math.abs(floor - fittedFloor(reference, reference) * scale) < 1e-9, `${reference}px at ${width}`);
      assert.ok(floor <= reference * scale);
    }
  }
  // Without a reference size it keeps the old absolute floor.
  assert.equal(fittedFloor(19, 0), 14);
});

test('FittedText is given each layer\'s reference size', () => {
  // Wiring: without the prop the floor silently falls back to 14 screen pixels.
  assert.match(read('../src/components/themes/builder/theme-stage.tsx'), /<FittedText[^>]*referenceSize=\{style\.fontSize\}/);
  assert.match(read('../src/components/themes/builder/layers/fitted-text.tsx'), /const minimum = fittedFloor\(authored, referenceSize \?\? authored\);/);
});

test('stages on common Saudi phones are 188–364px wide, not the 390px the editor shows', () => {
  // The guest page's own CSS, byte for byte.
  assert.equal(stageMaxWidth(FLOW, STAGE_RESERVE.flow), 'min(26rem, calc((100dvh - 10rem - var(--dawati-bottom-inset, 0px)) * 390 / 620))');
  assert.match(read('../src/app/globals.css'), /\.dawati-scene \{[^}]*padding: 4rem 1\.5rem;/);
  const view = read('../src/components/guest/invitation-view.tsx');
  for (const kind of ['cover', 'flow', 'pass']) assert.match(view, new RegExp(`stageMaxWidth\\(\\w+\\.canvas, STAGE_RESERVE\\.${kind}\\)`));

  const width = (id: string, canvas: typeof FLOW, kind: keyof typeof STAGE_RESERVE) =>
    Math.round(guestStageWidth(canvas, kind, GUEST_PHONES.find(p => p.id === id)!));
  // A flow screen (details, greeting, open card…) and the tallest entry pass.
  assert.deepEqual(GUEST_PHONES.map(p => [p.id, width(p.id, FLOW, 'flow'), width(p.id, RIBBON_PASS, 'pass')]), [
    ['android-360', 309, 244], ['iphone-se', 244, 188], ['iphone-390', 317, 250], ['android-412', 364, 315], ['iphone-430', 364, 290],
  ]);
  // A preview bar fixed at the bottom narrows every stage further.
  assert.ok(guestStageWidth(FLOW, 'flow', { width: 390, height: 664, bottomInset: 56 }) < guestStageWidth(FLOW, 'flow', { width: 390, height: 664 }));
  // The pass without a QR sits on the same screen as the pass.
  assert.equal(stageKindFor('passNoQr'), 'pass');
  assert.equal(stageKindFor('flow'), 'flow');
});
