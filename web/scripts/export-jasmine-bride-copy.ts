import { mkdirSync, writeFileSync } from 'node:fs';
import { jasmineBrideCopyDesign } from '../src/lib/themes/builder/jasmine-bride-copy';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
mkdirSync('design-exports', { recursive: true });
const design = jasmineBrideCopyDesign();
assertLayoutDoc(design.layout);
writeFileSync(`design-exports/${design.family}.json`, JSON.stringify({
  slug: design.family, name: 'Jasmine Bride (Copy)', nameAr: design.name,
  category: 'classic', status: 'PUBLISHED', engine: 'BUILDER', layout: design.layout, typography: design.typography,
  variants: design.variants.map((v, i) => ({ slug: v.slug, name: v.name, colorTag: v.colorTag, isDefault: i === 0, sortOrder: i, palette: v.palette, layoutOverrides: v.overrides, assets: v.assets })),
}, null, 2) + '\n');
console.log(`Saved design-exports/${design.family}.json`);
