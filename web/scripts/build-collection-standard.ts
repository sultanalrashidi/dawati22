import { writeFileSync } from 'node:fs';
import snapshot from '../src/data/public-theme-catalog.snapshot.json';
import { assertLayoutDoc, parseLayoutDoc } from '../src/lib/themes/builder/schema';
import { COLLECTION_TYPOGRAPHY, standardizeLayout, standardizePalette, standardizeOverrides } from '../src/lib/themes/builder/collection-standard';
import type { LayoutOverrides } from '../src/lib/themes/builder/resolve';

const output = structuredClone(snapshot);
let layouts = 0;
for (const entry of output) {
  if (typeof entry.builder.layout === 'object') {
    entry.builder.layout = assertLayoutDoc(standardizeLayout(parseLayoutDoc(entry.builder.layout), entry.config.family)) as typeof entry.builder.layout;
    layouts++;
  }
  if (typeof entry.builder.typography === 'object') entry.builder.typography = COLLECTION_TYPOGRAPHY;
  entry.builder.palette = standardizePalette(entry.builder.palette);
  entry.builder.overrides = standardizeOverrides(entry.builder.overrides as LayoutOverrides, entry.config.family, entry.builder.palette) as typeof entry.builder.overrides;
  entry.config.palette = entry.builder.palette;
  entry.config.fonts = { arabicDisplay: 'Amiri', arabicBody: 'IBM Plex Sans Arabic', latinDisplay: 'Cormorant Garamond' };
}
writeFileSync('src/data/collection-standard.snapshot.json', JSON.stringify(output, null, 2) + '\n');
console.log(`Saved ${layouts} layouts and ${output.length} colour variants.`);
