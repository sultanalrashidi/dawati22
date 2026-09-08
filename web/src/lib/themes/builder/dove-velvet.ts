import { starterLayoutDoc } from './starter-layout';
import { COLLECTION_TYPOGRAPHY, standardizeLayout, readableInk } from './collection-standard';
import { DEFAULT_TEXT_STYLE, DEFAULT_TRANSFORM, type TextLayer, type VariantPalette } from './types';

export const DOVE_FAMILY = 'dove-velvet';
export const DOVE_COLOURS = [
  { slug: 'burgundy', name: 'عنابي', bg: '#40131D', ink: '#481C27' },
  { slug: 'navy', name: 'كحلي', bg: '#10253F', ink: '#20334C' },
  { slug: 'emerald', name: 'زمردي', bg: '#103F32', ink: '#204738' },
  { slug: 'mocha', name: 'موكا', bg: '#493225', ink: '#4D3528' },
  { slug: 'mauve', name: 'موف', bg: '#905C60', ink: '#543A50' },
  { slug: 'petrol', name: 'أزرق بترولي', bg: '#104557', ink: '#204653' },
] as const;

export function doveLayout() {
  const doc = standardizeLayout(starterLayoutDoc());
  doc.page = { slot: 'background', fit: 'cover', overlayColor: '#000000', overlayOpacity: 0.16 };
  doc.animation = { envelopeEntrance: 'fade', envelopeOpening: 'normal', cardEntrance: 'fade', duration: 700, delay: 0 };
  for (const scene of doc.scenes) {
    if (scene.id === 'cover') scene.canvas = { aspectW: 1200, aspectH: 800, safeInset: 4 };
    if (scene.id === 'open') scene.canvas = { aspectW: 900, aspectH: 1200, safeInset: 4 };
    if (scene.id === 'pass') scene.canvas = { aspectW: 900, aspectH: 1600, safeInset: 5 };
  }
  doc.layers = doc.layers.filter(l => !l.id.startsWith('s_pass_'));
  for (const layer of doc.layers) {
    if (layer.type === 'seal') {
      layer.mode = 'static';
      layer.text = '';
      layer.script = 'arabic';
      layer.base = { ...DEFAULT_TRANSFORM, x: 50, y: 65.2, width: 9, height: 12 };
      layer.style = { ...layer.style, font: 'Amiri', fontSize: 22, color: '#481C27' };
    }
    if (layer.type === 'asset') {
      layer.base = { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 100, height: 100 };
      // Trace the actual envelope edge, excluding the photographed backdrop.
      // These scenes match their image aspect ratios so the silhouette stays aligned.
      if (layer.slot === 'envelopeClosed') layer.clipPolygon = [[3.2,12.7],[96.8,12.7],[96.8,87.1],[3.2,87.1]].map(([x,y]) => ({x,y}));
      if (layer.slot === 'envelopeOpen') layer.clipPolygon = [[5.4,96.1],[5.4,36.7],[9.3,28.4],[10.2,27.5],[15.8,23.5],[15.8,22.7],[17.5,22.7],[48.2,1.5],[49.2,1.1],[50,1],[50.8,1.1],[51.8,1.5],[82.5,22.7],[84.2,22.7],[84.2,23.5],[89.8,27.5],[90.7,28.4],[94.6,36.7],[94.6,96.1]].map(([x,y]) => ({x,y}));
    }
    if (layer.type === 'text' && layer.scene === 'open') {
      const y = layer.id === 's_open_guest_label' ? 39 : layer.id === 's_open_guest_name' ? 48 : 58;
      layer.base = { ...DEFAULT_TRANSFORM, x: 50, y, width: 52, height: layer.id === 's_open_guest_name' ? 10 : 7 };
      layer.style.color = '#3F3432';
      layer.style.fontSize = layer.id === 's_open_guest_name' ? 27 : 15;
      if (layer.id === 's_open_invitation_text') { layer.source = 'static'; layer.fields = []; layer.text = 'بكل محبة، ننتظر حضوركم'; }
    }
    if (layer.type === 'rsvp') { layer.fieldBackground = '@surface'; layer.fieldStyle.color = '#302B29'; }
    // Keep the opening text beneath the dove cluster, with the approved type hierarchy.
    if (layer.id === 'f_greeting_opening') { layer.base.y = 24; layer.base.height = 19; }
    if (layer.id === 'f_greeting_host') layer.base.y = 42;
    if (layer.id === 'f_greeting_couples') layer.base.y = 57;
    if (layer.id === 'f_greeting_inshallah') layer.base.y = 69;
    if (layer.id === 'f_greeting_date') layer.base.y = 79;
  }
  const text = (id: string, name: string, y: number, height: number, size: number, fields: TextLayer['fields'], copy = ''): TextLayer => ({
    id, name, scene: 'pass', type: 'text', visible: true, locked: false, z: 2,
    source: fields.length ? 'content' : 'static', fields, text: copy,
    base: { ...DEFAULT_TRANSFORM, x: 50, y, width: 72, height },
    style: { ...DEFAULT_TEXT_STYLE, font: 'Amiri', fontSize: size, fontWeight: 400, color: '#3F3432', lineHeight: 1.5, align: 'center' },
  });
  doc.layers.push(
    { id: 'dove_pass_card', type: 'asset', name: 'ورق بطاقة الدخول', scene: 'pass', z: 0, visible: true, locked: false, slot: 'card', fit: 'contain', base: { ...DEFAULT_TRANSFORM, width: 100, height: 100 } },
    text('dove_pass_title', 'عنوان البطاقة', 22, 5, 22, [], 'بطاقة الدخول'),
    text('dove_pass_couple', 'العروسان', 33, 14, 38, ['coupleLine']),
    text('dove_pass_date', 'التاريخ والوقت', 46, 10, 21, ['eventDateShort', 'eventTime']),
    text('dove_pass_place', 'المكان', 56, 8, 19, ['locationFull']),
    text('dove_pass_guest', 'اسم الضيف', 64, 5, 21, ['guestName']),
    { id: 'dove_pass_qr', type: 'qr', name: 'رمز الدخول', scene: 'pass', z: 3, visible: true, locked: false, padding: 6, borderRadius: 8, background: '#FFFFFF', borderColor: '#FFFFFF', borderWidth: 0, fgColor: '#171717', base: { ...DEFAULT_TRANSFORM, x: 50, y: 76, width: 27, height: 15.2 } },
    text('dove_pass_count', 'عدد الأشخاص', 89, 5, 18, [], 'عدد الأشخاص: {allowedCount}'),
  );
  return doc;
}

export function doveDesign() {
  const layout = doveLayout();
  const variants = DOVE_COLOURS.map(colour => {
    const palette: VariantPalette = { bg: colour.bg, surface: '#F7F0E7', fg: '#FFF9F2', fgMuted: '#F1E9E1', accent: '#E7D9C8', accentFg: colour.ink, swatch: colour.bg };
    if (colour.slug === 'mauve') palette.fgMuted = '#FFF9F2';
    palette.fgMuted = readableInk(palette.fgMuted, palette.bg);
    const assets = Object.fromEntries(['background','envelopeClosed','envelopeOpen','card','cardNoQr'].map(slot => [slot, `/themes/dove-velvet/${colour.slug}/${slot === 'cardNoQr' ? 'card' : slot.startsWith('envelope') ? `${slot}-matched` : slot}.png`]));
    const overrides = Object.fromEntries(layout.layers.filter(l => l.type === 'text' && (l.scene === 'pass' || l.scene === 'open')).map(l => [l.id, { paint: { style: { color: colour.ink } } }]));
    return { slug: `${DOVE_FAMILY}-${colour.slug}`, name: colour.name, palette, originalPalette: palette, assets, overrides, originalOverrides: overrides };
  });
  return { family: DOVE_FAMILY, name: 'حمام الوصل', layout, original: layout, typography: COLLECTION_TYPOGRAPHY, originalTypography: COLLECTION_TYPOGRAPHY, variants };
}
