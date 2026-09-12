import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starterLayoutDoc } from '../src/lib/themes/builder/starter-layout';
import { assertLayoutDoc, parseLayoutDoc } from '../src/lib/themes/builder/schema';
import { COLLECTION_TYPOGRAPHY, contrast, standardizePalette } from '../src/lib/themes/builder/collection-standard';
import { jasmineNewDesignLayout, jasmineReference } from '../src/lib/themes/builder/jasmine-standard';
import { DEFAULT_PALETTE, DEFAULT_TYPOGRAPHY_DOC } from '../src/lib/themes/builder/types';

test('a new design opens on عروس الياسمين, not the bare starter', () => {
  const baseline = jasmineNewDesignLayout();
  assert.deepEqual(baseline, jasmineReference().layout);
  assert.notDeepEqual(baseline, starterLayoutDoc());
  assert.deepEqual(baseline.scenes.map(s => s.id), ['cover', 'open', 'greeting', 'details', 'countdown', 'schedule', 'notes', 'rsvp', 'pass']);
  // It has to survive the same validation every stored document goes through.
  assert.ok(parseLayoutDoc(assertLayoutDoc(structuredClone(baseline))));
});

test('every new design gets its own copy of the reference', () => {
  const one = jasmineNewDesignLayout();
  one.layers[0].base.x = 1;
  assert.notEqual(jasmineNewDesignLayout().layers[0].base.x, 1);
});

test('the starting palette already clears 4.5:1 instead of being corrected later', () => {
  for (const [ink, ground] of [['fg', 'bg'], ['fgMuted', 'bg'], ['accentFg', 'accent']] as const) {
    const ratio = contrast(DEFAULT_PALETTE[ink], DEFAULT_PALETTE[ground]);
    assert.ok(ratio >= 4.5, `${ink} on ${ground} is ${ratio.toFixed(2)}:1`);
  }
  // Re-derived rather than trusted: the constant is what readableInk produces,
  // so a hand edit that drops it back below the floor fails here.
  assert.deepEqual(standardizePalette(DEFAULT_PALETTE), DEFAULT_PALETTE);
});

test('a new design starts on the house typeface', () => {
  assert.deepEqual(DEFAULT_TYPOGRAPHY_DOC.roles, COLLECTION_TYPOGRAPHY.roles);
  assert.equal(DEFAULT_TYPOGRAPHY_DOC.roles.display.family, 'Amiri');
  assert.equal(DEFAULT_TYPOGRAPHY_DOC.roles.body.family, 'IBM Plex Sans Arabic');
  assert.equal(DEFAULT_TYPOGRAPHY_DOC.roles.latin.family, 'Cormorant Garamond');
});

test('both admin paths that write a starting document go through the baseline', () => {
  // Wiring, not behaviour: the service is server-only and cannot be imported
  // here, and a new design silently reverting to the bare starter is exactly
  // the regression this whole change exists to prevent.
  const source = readFileSync(new URL('../src/lib/admin/themes/builder-service.ts', import.meta.url), 'utf8');
  assert.match(source, /layout: \{ create: \{ doc: json\(await newDesignStart\(\)\) \} \}/);
  assert.match(source, /layers: \(await newDesignStart\(\)\)\.layers/);
  // The live عروس الياسمين first, so the owner's later edits carry over; the committed copy if it is gone.
  assert.match(source, /theme: \{ slug: REFERENCE_THEME_SLUG \}/);
  assert.match(source, /return jasmineNewDesignLayout\(\);/);
  assert.doesNotMatch(source, /starterLayoutDoc/);
});
