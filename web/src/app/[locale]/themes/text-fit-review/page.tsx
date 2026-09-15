import fs from 'node:fs';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { TextFitReview, type TextFitDesign } from '@/components/themes/text-fit-review';
import { assertLayoutDoc, assertTypographyDoc } from '@/lib/themes/builder/schema';
import { GUEST_PHONES } from '@/lib/themes/builder/stage-size';
import type { LayoutOverrides } from '@/lib/themes/builder/resolve';
import type { VariantPalette } from '@/lib/themes/builder/types';

type Theme = { themeId: string; family: string; name: string; layout: unknown; typography: unknown;
  variants: { slug: string; palette: VariantPalette; assets: Record<string, string>; overrides: LayoutOverrides }[] };

/** Style keys that change how text sets; every other paint key is a colour. */
const TYPE_KEYS = ['font', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'align'];

/** What of a colour's overrides can change where text sits or how big it is. */
function arrangement(overrides: LayoutOverrides): string {
  return JSON.stringify(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)).flatMap(([id, entry]) => {
    if (!entry) return [];
    const { paint, ...geometry } = entry;
    const style = (paint?.style ?? {}) as Record<string, unknown>;
    const type = Object.fromEntries(TYPE_KEYS.filter(key => key in style).map(key => [key, style[key]]));
    return Object.keys(geometry).length || Object.keys(type).length ? [[id, geometry, type]] : [];
  }));
}

// Dev-only: every design, colour and screen at the width the guest page gives
// it on one phone (`?phone=`) or at the 390px reference (`?reference=1`), with
// the sample or long content (`?long=1`, `?venue=`), read from a catalogue
// scripts/text-room.ts wrote into TEXT_FIT_DIR (`?which=live` or `proposed`).
// Colours that differ only in colour are drawn once; `?only=` and `?scene=`
// narrow it down and `?images=1` adds the artwork.
export default async function TextFitReviewPage({ searchParams }: {
  searchParams: Promise<{ phone?: string; long?: string; venue?: string; which?: string; only?: string; scene?: string; reference?: string; images?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const dir = process.env.TEXT_FIT_DIR;
  if (!dir) notFound();
  const { phone: phoneId, long, venue, which = 'live', only, scene, reference, images } = await searchParams;
  const phone = GUEST_PHONES.find(p => p.id === phoneId) ?? GUEST_PHONES[0];
  if (!/^[a-z]+$/.test(which)) notFound();
  const families = only?.split(',');
  const themes = JSON.parse(fs.readFileSync(`${dir}/${which}-themes.json`, 'utf8')) as Theme[];
  const designs: TextFitDesign[] = themes.filter(t => !families || families.includes(t.family)).map(theme => {
    const groups = new Map<string, TextFitDesign['variants'][number]>();
    for (const variant of theme.variants) {
      const key = arrangement(variant.overrides ?? {});
      const group = groups.get(key);
      if (group) group.slugs.push(variant.slug);
      else groups.set(key, { slugs: [variant.slug], palette: variant.palette, assets: variant.assets, overrides: variant.overrides ?? {} });
    }
    return { family: theme.family, name: theme.name, layout: assertLayoutDoc(theme.layout),
      typography: assertTypographyDoc(theme.typography), variants: [...groups.values()] };
  });
  const qrDataUrl = await QRCode.toDataURL('text-fit-preview-not-an-entry-pass', { margin: 1, width: 320 });
  return <TextFitReview designs={designs} phone={phone} long={long === '1'} venue={venue} scenes={scene?.split(',')} reference={reference === '1'} images={images === '1'} qrDataUrl={qrDataUrl} />;
}
