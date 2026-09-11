import { doveDesign } from '@/lib/themes/builder/dove-velvet';
import { floralDesigns } from '@/lib/themes/builder/floral-pair';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import original from '@/data/public-theme-catalog.snapshot.json';
import updated from '@/data/collection-standard.snapshot.json';
import { assertLayoutDoc, assertTypographyDoc } from '@/lib/themes/builder/schema';
import { CollectionReview } from '@/components/themes/collection-review';
import type { LayoutOverrides } from '@/lib/themes/builder/resolve';

export default async function CollectionReviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  function read(catalog: typeof original, raw: unknown, field: 'layout' | 'typography', depth = 0): unknown {
    if (typeof raw !== 'string') return raw;
    const match = /:themes:(\d+):builder:(layout|typography)$/.exec(raw);
    if (!match || match[2] !== field || depth > catalog.length) throw new Error('Invalid catalog reference');
    return read(catalog, catalog[Number(match[1])].builder[field], field, depth + 1);
  }
  const catalog = updated as unknown as typeof original;
  const families = [...new Set(catalog.map(e => e.config.family))];
  const designs = families.map(family => {
    const first = catalog.find(e => e.config.family === family)!;
    const before = original.find(e => e.config.family === family)!;
    return { family, name: first.name.replace(' (نسخة)', ''),
      layout: assertLayoutDoc(read(catalog, first.builder.layout, 'layout')),
      original: assertLayoutDoc(read(original, before.builder.layout, 'layout')),
      typography: assertTypographyDoc(read(catalog, first.builder.typography, 'typography')),
      originalTypography: assertTypographyDoc(read(original, before.builder.typography, 'typography')),
      variants: catalog.filter(e => e.config.family === family).map(e => {
        const old = original.find(o => o.id === e.id)!;
        return { slug: e.slug, name: e.config.colorTag || 'الأساسي', palette: e.builder.palette,
          originalPalette: old.builder.palette, assets: e.builder.assets as Record<string, string>,
          overrides: e.builder.overrides as LayoutOverrides, originalOverrides: old.builder.overrides as LayoutOverrides };
      }),
    };
  });
  const qrDataUrl = await QRCode.toDataURL('dawati-preview-not-an-entry-pass', { margin: 1, width: 320 });
  return <CollectionReview designs={[...designs, doveDesign(), ...floralDesigns()]} qrDataUrl={qrDataUrl} />;
}
