import { defaultFlowLayers, defaultSceneList } from './default-flow';
import { proposeRibbonGreeting, RIBBON_THEME_SLUG } from './ribbon-greeting';
import { proposeRibbonFlow } from './ribbon-flow';
import { DEFAULT_TYPOGRAPHY_DOC, type LayoutDoc, type Layer, type TextLayer, type TextStyle, type VariantPalette } from './types';
import type { LayoutOverrides } from './resolve';

export const COLLECTION_TYPOGRAPHY = { ...DEFAULT_TYPOGRAPHY_DOC, roles: {
  display: { family: 'Amiri', weight: 400 }, body: { family: 'IBM Plex Sans Arabic', weight: 400 },
  latin: { family: 'Cormorant Garamond', weight: 500 },
} };

// Explicit document edit, shared by the saved catalog and database migration.
// The renderer never substitutes an invisible preset over the editor's document.
function flowReference() {
  const doc: LayoutDoc = { version: 3, page: { slot: 'background', fit: 'cover', overlayColor: '#000000', overlayOpacity: 0 },
    scenes: defaultSceneList(), layers: defaultFlowLayers(), animation: { envelopeEntrance: 'fade', envelopeOpening: 'normal', cardEntrance: 'fade', duration: 600, delay: 0 } };
  const greeting = proposeRibbonGreeting(RIBBON_THEME_SLUG, doc);
  if (!greeting.ok) throw new Error(greeting.reason);
  const flow = proposeRibbonFlow(RIBBON_THEME_SLUG, greeting.layout);
  if (!flow.ok) throw new Error(flow.reason);
  return flow.layout.layers;
}
const FLOW = flowReference();
/** The collection's flow screens as the standard places them, before any design's own adjustments. */
export const standardFlowLayers = (): Layer[] => structuredClone(FLOW);
const round = (n: number) => Math.round(n * 100) / 100;
function setText(layer: TextLayer, font: string, size: number, weight = 400): TextLayer {
  const { tabletStyle: _tablet, desktopStyle: _desktop, ...rest } = layer;
  void _tablet; void _desktop;
  return { ...rest, style: { ...layer.style, font, fontSize: size, fontWeight: weight, letterSpacing: 0, lineHeight: 1.5, align: 'center' } };
}

export function standardizeLayout(original: LayoutDoc, family = ""): LayoutDoc {
  const doc = structuredClone(original);
  doc.layers = doc.layers.map((layer): Layer => {
    const reference = FLOW.find(l => l.id === layer.id && l.type === layer.type);
    if (reference) {
      // Keep customer copy, bindings, visibility and colours; adopt hierarchy and spacing.
      const next = { ...layer, base: { ...reference.base }, tablet: undefined, desktop: undefined } as Layer;
      for (const key of ['style', 'titleStyle', 'numberStyle', 'labelStyle', 'timeStyle', 'itemStyle', 'fieldStyle'] as const) {
        if (key in reference && key in next) {
          const target = next as unknown as Record<string, unknown>;
          const source = reference as unknown as Record<string, unknown>;
          target[key] = { ...(source[key] as TextStyle), color: (target[key] as TextStyle).color };
        }
      }
      if ('overflow' in reference) Object.assign(next, { overflow: reference.overflow });
      if ('borderRadius' in reference) Object.assign(next, { borderRadius: reference.borderRadius });
      if ('rowGap' in reference) Object.assign(next, { rowGap: reference.rowGap });
      if (next.type === 'text') { delete next.tabletStyle; delete next.desktopStyle; if (next.id === 'f_greeting_date' && !next.fields.includes('eventTime')) next.fields.push('eventTime'); }
      if (next.type === 'rsvp') next.fieldBackground = '@surface';
      return next;
    }
    if (layer.type !== 'text') return layer;
    if (layer.scene === 'open') {
      const name = layer.fields.includes('guestName');
      return setText(layer, name ? 'Amiri' : 'IBM Plex Sans Arabic', name ? 24 : 14);
    }
    if (layer.scene === 'pass') return setText(layer, 'Amiri', layer.style.fontSize);
    return layer;
  });
  const qr = doc.layers.find(l => l.scene === 'pass' && l.type === 'qr');
  const imported = doc.layers.find(l => l.id === 'li_pass_invitation');
  if (qr && imported) {
    const top = Math.max(15.5, imported.base.y - 8);
    const end = qr.base.y - (qr.base.height ?? 12) / 2 - 3.5;
    const span = end - top;
    const canvas = doc.scenes.find(s => s.id === 'pass')!.canvas;
    const scale = Math.min(1, span / 50.8 * (canvas.aspectH / canvas.aspectW) / (1700 / 900));
    const place = (layer: TextLayer, y: number, h: number, size: number, x = 50, width = 68): TextLayer => ({
      ...setText(layer, 'Amiri', round(size * Math.max(.7, scale))),
      base: { ...layer.base, x, y: round(top + (y - 15.5) / 50.8 * span), width, height: round(h / 50.8 * span), scale: 1, rotation: 0 },
    });
    const positions: Record<string, number[]> = {
      li_pass_invitation: [21.5, 7, 18], li_pass_couple: [33.5, 16.5, 42], li_pass_godwilling: [44.25, 4.5, 21],
      li_pass_date: [49, 4.5, 23, 64, 38], li_pass_time: [49, 4.5, 23, 30, 25], li_pass_place: [57.5, 12.2, 22],
    };
    const bindings = { li_pass_couple: 'coupleLine', li_pass_date: 'eventDateShort', li_pass_time: 'eventTime', li_pass_place: 'locationFull' } as const;
    doc.layers = doc.layers.map(l => {
      if (l.type !== 'text' || !positions[l.id]) return l;
      const [y, h, size, x, width] = positions[l.id];
      const next = place(l, y, h, size, x, width);
      const field = bindings[l.id as keyof typeof bindings];
      if (field) Object.assign(next, { source: 'content', fields: [field], text: '' });
      return next;
    });
    const template = doc.layers.find(l => l.id === 'li_pass_invitation') as TextLayer;
    const make = (id: string, name: string, fields: TextLayer['fields'], text: string, y: number, h: number, size: number) =>
      place({ ...template, id, name, z: 20, source: fields.length ? 'content' : 'static', fields, text, visible: true }, y, h, size);
    for (const layer of [
      make('rb_pass_title', 'عنوان بطاقة الدخول', [], 'بطاقة الدخول', 15.5, 4.5, 24),
      make('rb_pass_guest', 'اسم المدعو', ['guestName'], '', 66.3, 5.1, 21),
    ]) if (!doc.layers.some(l => l.id === layer.id)) doc.layers.push(layer);
    // Space below the existing QR depends on the artwork. Use it only when it exists.
    const bottom = qr.base.y + (qr.base.height ?? 12) / 2;
    const existingCount = doc.layers.find(l => l.id === 'rb_pass_count');
    if (bottom < 90 && !existingCount) {
      const count = make('rb_pass_count', 'عدد الأشخاص', [], 'عدد الأشخاص: {allowedCount}', 66.3, 4, 19);
      count.base.y = Math.min(93, bottom + 3.5); count.base.height = 4;
      doc.layers.push(count);
    } else if (existingCount && existingCount.base.y - (existingCount.base.height ?? 4) / 2 < bottom) {
      // A count placed by hand before this rule existed can sit inside the QR's
      // box. The seats line is the one label that may be moved to clear it: the
      // quiet zone is what a scanner reads, not decoration.
      existingCount.base.y = Math.min(93, bottom + (existingCount.base.height ?? 4) / 2 + 1.5);
    }
    // Sapphire's extra host/closing/footer lines need their own space in the same hierarchy.
    doc.layers = doc.layers.map(l => {
      if (l.type !== 'text') return l;
      if (l.id === 'l_3609ebe9') return place(l, 24, 8, 16);
      if (l.id === 'l_3d60a032') return place(l, 61.5, 3, 15);
      if (l.id === 'l_daa9f144') return { ...setText(l, 'Amiri', 12), base: { ...l.base, x: 50, width: 68, y: 96, height: 3 } };
      return l;
    });
  } else {
    // These four artworks have smaller inset cards. Keep their art-specific text slots.
    doc.layers = doc.layers.map(l => {
      if (l.type !== 'text' || l.scene !== 'pass') return l;
      if (l.id === 's_pass_couple') return { ...setText(l, 'Amiri', 30), source: 'content', fields: ['coupleLine'] };
      if (l.id === 's_pass_details') return { ...setText(l, 'Amiri', 16), source: 'content', fields: ['eventDateShort', 'eventTime', 'locationFull'], base: { ...l.base, height: 20 } };
      if (l.id === 's_pass_guest') return setText(l, 'Amiri', 18);
      return l;
    });
  }
  // Keep the same reading order while clearing each family's printed ornaments.
  const hasTopOrnament = ['gilded-tassel-copy', 'sapphire-bloom-copy', 'pearl-waves'].includes(family);
  for (const layer of doc.layers) {
    if (family === 'floral-candles') {
      if (layer.id === 's_pass_couple') Object.assign(layer.base, { y: 35, height: 10 });
      if (layer.id === 's_pass_details') Object.assign(layer.base, { y: 49, height: 16 });
    }
    if (!layer.id.startsWith('f_')) continue;
    if (hasTopOrnament) {
      if (layer.scene === 'greeting') layer.base.y = round(26 + (layer.base.y - 18) * .88);
      if (layer.scene === 'details') layer.base.y = round(26 + (layer.base.y - 19) * .89);
      if (layer.type === 'schedule' || layer.type === 'notes') Object.assign(layer.base, { y: 52, height: 52 });
      if (layer.type === 'rsvp') Object.assign(layer.base, { y: 57, height: 64 });
    }
    if (family === 'crystal-dew') {
      layer.base.x = 56; layer.base.width = Math.min(68, layer.base.width);
      if (layer.id === 'f_greeting_opening' && layer.type === 'text') { Object.assign(layer.base, { x: 64, width: 56, y: 19, height: 24 }); layer.style.fontSize = 17; }
      if (layer.id === 'f_greeting_host') Object.assign(layer.base, { x: 60, width: 64, y: 39 });
      if (layer.id === 'f_greeting_couples') Object.assign(layer.base, { x: 60, width: 64, y: 54 });
      if (layer.id === 'f_greeting_inshallah') Object.assign(layer.base, { x: 58, y: 65 });
      if (layer.id === 'f_greeting_date') Object.assign(layer.base, { x: 54, y: 75 });
    }
  }
  return doc;
}

function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function luminance(hex: string) { return rgb(hex).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); }
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function readableInk(ink: string, bg: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(ink) || !/^#[0-9a-f]{6}$/i.test(bg)) return ink;
  if (contrast(ink, bg) >= 4.5) return ink;
  const target = luminance(bg) > .179 ? 0 : 255;
  const channels = rgb(ink);
  for (let step = 1; step <= 100; step++) {
    const adjusted = '#' + channels.map(c => Math.round(c + (target - c) * step / 100).toString(16).padStart(2, '0')).join('');
    if (contrast(adjusted, bg) >= 4.5) return adjusted;
  }
  return ink;
}
export function standardizePalette(palette: VariantPalette): VariantPalette {
  return { ...palette, fg: readableInk(palette.fg, palette.bg), fgMuted: readableInk(palette.fgMuted, palette.bg), accentFg: readableInk(palette.accentFg, palette.accent) };
}
export function standardizeOverrides(overrides: LayoutOverrides, family = "", palette?: VariantPalette): LayoutOverrides {
  // Paint is per design and per colour; cover/QR/art geometry remains authored.
  const copy = structuredClone(overrides);
  for (const [id, entry] of Object.entries(copy)) {
    if (entry && id.startsWith('f_')) copy[id] = entry.paint ? { paint: entry.paint } : undefined;
  }
  // Floral Candles has ivory paper inside a dark page. Its pass ink must
  // follow the paper, not the page's pale foreground roles.
  if (family === 'floral-candles' && palette) {
    const paper = '#E7D6BF';
    for (const id of ['s_pass_couple', 's_pass_details', 's_pass_guest']) {
      const current = copy[id] ?? {};
      const paint = current.paint ?? {};
      copy[id] = { ...current, paint: { ...paint, style: {
        ...(paint.style as Record<string, unknown> | undefined),
        color: readableInk(id === 's_pass_details' ? palette.surface : palette.bg, paper),
      } } };
    }
  }
  return copy;
}
