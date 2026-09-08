import { mkdirSync, writeFileSync } from 'node:fs';
import { doveDesign } from '../src/lib/themes/builder/dove-velvet';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
const design = doveDesign();
assertLayoutDoc(design.layout);
mkdirSync('design-exports', { recursive: true });
writeFileSync('design-exports/dove-velvet.json', JSON.stringify({
  slug: design.family, name: 'Dove Velvet', nameAr: design.name, category: 'romantic', status: 'DRAFT', engine: 'BUILDER',
  layout: design.layout, typography: design.typography,
  variants: design.variants.map((v, i) => ({ slug: v.slug.replace('dove-velvet-', ''), name: v.name, colorTag: v.name, isDefault: i === 0, sortOrder: i, palette: v.palette, layoutOverrides: v.overrides, assets: v.assets })),
}, null, 2) + '\n');
console.log('Saved design-exports/dove-velvet.json');
