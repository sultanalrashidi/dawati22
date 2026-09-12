import fs from 'node:fs';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { CollectionReview } from '@/components/themes/collection-review';
import { assertLayoutDoc, assertTypographyDoc } from '@/lib/themes/builder/schema';
import type { LayoutOverrides } from '@/lib/themes/builder/resolve';
import type { VariantPalette } from '@/lib/themes/builder/types';

type Theme = { themeId: string; family: string; name: string; layout: unknown; typography: unknown;
  variants: { slug: string; name: string; palette: VariantPalette; assets: Record<string, string>; overrides: LayoutOverrides }[] };

// Dev-only: the live catalog next to its Jasmine-standard proposal, both read
// from files a generation script wrote (JASMINE_REVIEW_DIR).
export default async function JasmineStandardReviewPage({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const dir = process.env.JASMINE_REVIEW_DIR;
  if (!dir) notFound();
  const only = (await searchParams).only?.split(',');
  const live = JSON.parse(fs.readFileSync(`${dir}/live-themes.json`, 'utf8')) as Theme[];
  const proposed = JSON.parse(fs.readFileSync(`${dir}/proposed-themes.json`, 'utf8')) as Theme[];
  const designs = proposed.filter(t => !only || only.includes(t.family)).map(next => {
    const before = live.find(t => t.themeId === next.themeId)!;
    return { family: next.family, name: next.name,
      layout: assertLayoutDoc(next.layout), original: assertLayoutDoc(before.layout),
      typography: assertTypographyDoc(next.typography), originalTypography: assertTypographyDoc(before.typography),
      variants: next.variants.map(v => {
        const old = before.variants.find(o => o.slug === v.slug)!;
        return { slug: v.slug, name: v.name, palette: v.palette, originalPalette: old.palette, assets: v.assets,
          overrides: v.overrides, originalOverrides: old.overrides };
      }) };
  });
  const qrDataUrl = await QRCode.toDataURL('jasmine-standard-preview-not-an-entry-pass', { margin: 1, width: 320 });
  return <CollectionReview designs={designs} qrDataUrl={qrDataUrl} title="على نسق عروس الياسمين" initialScene="pass" />;
}
