import { mkdirSync, writeFileSync } from 'node:fs';
import { floralDesigns } from '../src/lib/themes/builder/floral-pair';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
mkdirSync('design-exports', { recursive: true });
for (const design of floralDesigns()) {
  assertLayoutDoc(design.layout);
  writeFileSync(`design-exports/${design.family}.json`, JSON.stringify({
    slug: design.family, name: design.family === 'pearl-garden' ? 'Pearl Garden' : 'Hibiscus Butterfly', nameAr: design.name,
    category: 'romantic', status: 'DRAFT', engine: 'BUILDER', layout: design.layout, typography: design.typography,
    variants: design.variants.map((v, i) => ({ slug: v.slug.replace(`${design.family}-`, ''), name: v.name, colorTag: v.name, isDefault: i === 0, sortOrder: i, palette: v.palette, layoutOverrides: v.overrides, assets: v.assets })),
  }, null, 2) + '\n');
  console.log(`Saved design-exports/${design.family}.json`);
}
