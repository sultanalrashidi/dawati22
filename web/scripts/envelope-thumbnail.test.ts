import test from 'node:test';
import assert from 'node:assert/strict';
import { doveDesign } from '../src/lib/themes/builder/dove-velvet';
import { starterLayoutDoc } from '../src/lib/themes/builder/starter-layout';
import { builderThemeThumbnail } from '../src/lib/themes/thumbnail';

test('حمام الوصل: the tile cuts the envelope out of its photo as the cover scene does', () => {
  const design = doveDesign();
  for (const v of design.variants) {
    const { url, cutout } = builderThemeThumbnail({
      layout: design.layout,
      typography: design.typography,
      palette: v.palette,
      assets: v.assets,
      overrides: v.overrides,
    });
    assert.equal(url, v.assets.envelopeClosed);
    assert.ok(cutout, v.name);
    assert.equal(cutout.clipPath, 'polygon(3.2% 12.7%,96.8% 12.7%,96.8% 87.1%,3.2% 87.1%)');
    // The cover canvas is the photo's own 3:2, and the envelope layer fills it.
    assert.equal(cutout.canvasAspect, 1.5);
    assert.deepEqual([cutout.box.x, cutout.box.y, cutout.box.width, cutout.box.height], [50, 50, 100, 100]);
    // Where the checkerboard was, the design's own velvet shows through.
    assert.equal(cutout.backdrop.url, v.assets.background);
    assert.equal(cutout.backdrop.color, v.palette.bg);
  }
});

test('a full-bleed envelope photo is shown as it is', () => {
  const v = doveDesign().variants[0];
  const { url, cutout } = builderThemeThumbnail({
    layout: starterLayoutDoc(),
    typography: doveDesign().typography,
    palette: v.palette,
    assets: { envelopeClosed: '/e.png', background: '/b.png' },
    overrides: {},
  });
  assert.equal(url, '/e.png');
  assert.equal(cutout, undefined);
});

test('no builder art, no thumbnail', () => {
  assert.deepEqual(builderThemeThumbnail(undefined), {});
});
