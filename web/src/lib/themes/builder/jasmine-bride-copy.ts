import captured from '@/data/jasmine-bride-copy.layout.json';
import { standardizePalette } from './collection-standard';
import type { LayoutDoc, TypographyDoc, VariantPalette } from './types';
import type { LayoutOverrides } from './resolve';

/**
 * عروس الياسمين (نسخة): the live Jasmine Bride design in all nine colours of
 * its artwork set.
 *
 * The layout and typography are the production documents as captured on
 * 2026-09-12 (`src/data/jasmine-bride-copy.layout.json`), admin edits after
 * the collection standard included, so the copy reads exactly like the
 * original. The artwork is the original set: five of the nine colours were
 * never published, and the published pink has lost its images.
 *
 * Four colours reuse the live design's palettes and per-colour overrides
 * as they are, because their images are byte-identical to the live ones.
 * The other five get palettes sampled from their own artwork and a
 * monogram colour that reads on their ivory or pale seal. The live pink's
 * positional overrides were fitted to different, now-missing art, so they
 * are not carried over.
 */
export const JASMINE_COPY_FAMILY = 'jasmine-bride-copy';

const monogram = (color: string): LayoutOverrides => ({ li_cover_monogram: { paint: { style: { color } } } });

export const JASMINE_COPY_COLOURS: { slug: string; name: string; colorTag: string; palette: VariantPalette; overrides: LayoutOverrides }[] = [
  { slug: 'burgundy', name: 'عنابي', colorTag: 'عنابي',
    palette: { bg: '#EDE4E0', surface: '#F8F2EA', fg: '#6B2F3A', fgMuted: '#7c6065', accent: '#BE9A65', accentFg: '#363534', swatch: '#7B3040' },
    overrides: {
      f_rsvp: { paint: { accentFg: '@surface', fieldStyle: { color: '@fgMuted' }, borderColor: '@accent', fieldBackground: '@surface' } },
      f_schedule: { paint: { timeStyle: { color: '@fgMuted' } } },
      f_countdown: { paint: { boxColor: '@bg', labelStyle: { color: '@fg' }, titleStyle: { color: '@fg' }, borderColor: '@accent', numberStyle: { color: '@fgMuted' } } },
      f_details_map: { paint: { background: '@bg', borderColor: '@accent' } },
      rb_pass_count: { paint: { style: { color: '@fg' } } },
      f_details_when: { paint: { style: { color: '@fgMuted' } } },
      f_details_where: { paint: { style: { color: '@fg' } } },
      f_greeting_host: { paint: { style: { color: '@fgMuted' } } },
      f_details_calendar: { paint: { background: '@bg', borderColor: '@accent' } },
    } as LayoutOverrides },
  { slug: 'black-gold', name: 'أسود', colorTag: 'أسود',
    palette: { bg: '#EAE5DC', surface: '#F8F3EA', fg: '#262321', fgMuted: '#6c6661', accent: '#B59050', accentFg: '#2e2e2c', swatch: '#262321' },
    overrides: {
      f_details_map: { paint: { background: '#FFFDF7', borderColor: '@accent' } },
      f_details_calendar: { paint: { background: '#FFFDF7', borderColor: '@accent' } },
    } as LayoutOverrides },
  { slug: 'earthy-mauve', name: 'موف', colorTag: 'موف',
    palette: { bg: '#EEE7ED', surface: '#FAF6F1', fg: '#685766', fgMuted: '#736570', accent: '#B79A7A', accentFg: '#363534', swatch: '#A88FA3' },
    overrides: monogram('#806b7d') },
  { slug: 'luxury-sage', name: 'أخضر', colorTag: 'أخضر',
    palette: { bg: '#EEF1E8', surface: '#FAF7EF', fg: '#596452', fgMuted: '#686f60', accent: '#C6AB73', accentFg: '#424240', swatch: '#9DAA91' },
    overrides: monogram('#76886d') },
  { slug: 'powder-pink', name: 'وردي', colorTag: 'وردي',
    palette: { bg: '#F6E7E4', surface: '#FFF9F5', fg: '#7B5F63', fgMuted: '#7a6467', accent: '#C9A77C', accentFg: '#403f3e', swatch: '#D8A8B0' },
    overrides: monogram('#A07068') },
  { slug: 'mocha', name: 'موكا', colorTag: 'بني',
    palette: { bg: '#EFE4D8', surface: '#FAF3EA', fg: '#5E4535', fgMuted: '#735C4C', accent: '#B8956A', accentFg: '#3A2E26', swatch: '#8E6D51' },
    overrides: monogram('#7A5A44') },
  { slug: 'sand-beige', name: 'بيج', colorTag: 'بيج',
    palette: { bg: '#F2EADF', surface: '#FBF6EF', fg: '#5F4E3B', fgMuted: '#76664F', accent: '#C8A877', accentFg: '#3D3528', swatch: '#C9AE8B' },
    overrides: monogram('#8C7153') },
  { slug: 'navy-gold', name: 'كحلي', colorTag: 'كحلي',
    palette: { bg: '#EDE7DE', surface: '#F9F5EE', fg: '#23324A', fgMuted: '#545E73', accent: '#BD965F', accentFg: '#23324A', swatch: '#2F3F56' },
    overrides: monogram('#2F3F56') },
  { slug: 'sky-blue', name: 'سماوي', colorTag: 'أزرق',
    palette: { bg: '#EDF1F4', surface: '#F9FBFC', fg: '#3B5268', fgMuted: '#566B7E', accent: '#A9B9C8', accentFg: '#2C3A48', swatch: '#9DB9D3' },
    overrides: monogram('#5E7788') },
];

export function jasmineBrideCopyDesign() {
  const layout = structuredClone(captured.layout) as unknown as LayoutDoc;
  const typography = structuredClone(captured.typography) as unknown as TypographyDoc;
  const variants = JASMINE_COPY_COLOURS.map(colour => {
    const palette = standardizePalette(colour.palette);
    const assets = Object.fromEntries(['background', 'envelopeClosed', 'envelopeOpen', 'card', 'cardNoQr']
      .map(slot => [slot, `/themes/${JASMINE_COPY_FAMILY}/${colour.slug}/${slot}.png`]));
    return { slug: `${JASMINE_COPY_FAMILY}-${colour.slug}`, name: colour.name, colorTag: colour.colorTag, palette, originalPalette: palette,
      assets, overrides: colour.overrides, originalOverrides: colour.overrides };
  });
  return { family: JASMINE_COPY_FAMILY, name: 'عروس الياسمين (نسخة)', layout, original: layout, typography, originalTypography: typography, variants };
}
