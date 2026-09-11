import { doveLayout } from './dove-velvet';
import { COLLECTION_TYPOGRAPHY } from './collection-standard';
import type { VariantPalette } from './types';

export const FLORAL_FAMILIES = [
  { family: 'pearl-garden', name: 'حديقة اللؤلؤ', side: false, colours: [
    { slug: 'ivory', name: 'عاجي', bg: '#F3EEE3', ink: '#594732', swatch: '#D9C6A5' },
    { slug: 'blush', name: 'وردي', bg: '#F5EAE7', ink: '#633F49', swatch: '#C9929A' },
    { slug: 'sage', name: 'مريمي', bg: '#ECF0E7', ink: '#3E5140', swatch: '#9AAE94' },
    { slug: 'mist', name: 'أزرق ضبابي', bg: '#EBEFF3', ink: '#354E66', swatch: '#9AB2C9' },
  ] },
  { family: 'hibiscus-butterfly', name: 'ورد وفراشات', side: true, colours: [
    { slug: 'burgundy', name: 'عنابي', bg: '#DFCFB9', ink: '#541F29', swatch: '#712934' },
    { slug: 'mauve', name: 'موف', bg: '#DFCFB9', ink: '#533B54', swatch: '#8D6489' },
    { slug: 'navy', name: 'كحلي', bg: '#DFCFB9', ink: '#20334E', swatch: '#2C4261' },
    { slug: 'mocha', name: 'موكا', bg: '#DFCFB9', ink: '#50382B', swatch: '#84604A' },
  ] },
] as const;

export function floralDesigns() {
  return FLORAL_FAMILIES.map(family => {
    const layout = doveLayout();
    layout.page.overlayOpacity = 0;
    // The same border artwork fills the page and entry pass, without a nested frame.
    layout.layers = layout.layers.filter(l => l.id !== 'dove_pass_card');
    for (const layer of layout.layers) {
      if (layer.type === 'asset' && layer.slot === 'envelopeClosed') {
        // Keep the narrow paper rim, tracing the rounded corners rather than cutting into the flap.
        layer.clipPolygon = [[3.3,12.2],[96.7,12.2],[96.95,12.5],[96.95,87.1],[96.7,87.4],[3.3,87.4],[3.05,87.1],[3.05,12.5]].map(([x,y]) => ({x,y}));
      }
      if (layer.type === 'text' || layer.type === 'seal') layer.style.color = '@fg';
      if (layer.scene !== 'cover' && layer.scene !== 'open') {
        layer.base.x = family.side ? 70 : 50;
        if (layer.type !== 'qr') layer.base.width = family.side ? 52 : 72;
      }
      if (layer.type === 'rsvp') {
        layer.base.y = 50;
        layer.base.height = 76;
        layer.fieldBackground = '@surface';
        layer.fieldStyle.color = '@fg';
      }
      if (layer.id === 'f_greeting_opening') { layer.base.y = 23; layer.base.height = 19; }
      if (layer.id === 'f_greeting_host') { layer.base.y = 42; layer.base.height = 17; }
      if (layer.id === 'f_greeting_couples') { layer.base.y = 59; layer.base.height = 15; }
      if (layer.id === 'f_greeting_inshallah') layer.base.y = 71;
      if (layer.id === 'f_greeting_date') layer.base.y = 81;
      if (family.side) {
        // In the 52%-wide side column the Hijri date wraps onto a fourth line
        // on a ~310px stage (a 360px Android phone), and a fitted box that
        // overflows turns into a scroller that hides the time. The greeting
        // has no room below the date, so it sets two points smaller; the
        // details page gives its date and venue the free space at the bottom.
        if (layer.id === 'f_greeting_date' && layer.type === 'text') layer.style.fontSize -= 2;
        if (layer.id === 'f_details_title') layer.base.y = 17;
        if (layer.id === 'f_details_when') { layer.base.y = 32.5; layer.base.height = 21; }
        if (layer.id === 'f_details_where') { layer.base.y = 52; layer.base.height = 18; }
        if (layer.id === 'f_details_calendar') layer.base.y = 66.5;
        if (layer.id === 'f_details_map') layer.base.y = 77.5;
        if (layer.id === 'f_details_closing') layer.base.y = 88;
      }
      if (layer.id === 'dove_pass_couple') layer.base.y = 31;
      if (layer.id === 'dove_pass_date') { layer.base.y = 42; layer.base.height = 8; }
      if (layer.id === 'dove_pass_place') { layer.base.y = 53; layer.base.height = 13; }
      if (layer.id === 'dove_pass_guest') { layer.base.y = 65.5; layer.base.height = 10; }
      if (layer.id === 'dove_pass_qr') { layer.base.y = 80; layer.base.width = 27; layer.base.height = 15.2; }
      if (layer.id === 'dove_pass_count') layer.base.y = 92;
    }
    const variants = family.colours.map(colour => {
      const palette: VariantPalette = { bg: colour.bg, surface: '#FFFDF8', fg: colour.ink, fgMuted: colour.ink, accent: colour.ink, accentFg: '#FFFDF8', swatch: colour.swatch };
      const assets = Object.fromEntries(['background','envelopeClosed','envelopeOpen','card','cardNoQr'].map(slot => [slot, `/themes/${family.family}/${colour.slug}/${slot.startsWith('card') ? 'background' : slot}.png`]));
      return { slug: `${family.family}-${colour.slug}`, name: colour.name, palette, originalPalette: palette, assets, overrides: {}, originalOverrides: {} };
    });
    return { family: family.family, name: family.name, layout, original: layout, typography: COLLECTION_TYPOGRAPHY, originalTypography: COLLECTION_TYPOGRAPHY, variants };
  });
}
