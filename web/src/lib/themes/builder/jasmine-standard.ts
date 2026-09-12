import captured from '@/data/jasmine-reference.layout.json';
import { readableInk, standardFlowLayers } from './collection-standard';
import type { Layer, LayoutDoc, SealLayer, TextLayer, TextStyle, Transform, TypographyDoc, VariantPalette } from './types';
import type { LayerOverride, LayoutOverrides } from './resolve';

/**
 * عروس الياسمين is the pattern: every design reads like it, and every new
 * design starts from it.
 *
 * "Like it" means the same screens in the same order, the same lines on every
 * screen in the same typefaces and sizes, and the same entry pass — title,
 * blessing, couple, «وذلك بمشيئة الله تعالى», one date-time-place block, the
 * guest, the seats line, then the QR. What stays each design's own is what its
 * artwork decides: where the card, the seal and the printed QR frame sit, the
 * column its flowers leave free, and its colours.
 */
export const REFERENCE_THEME_SLUG = 'jasmine-bride-copy';

export function jasmineReference(): { layout: LayoutDoc; typography: TypographyDoc } {
  return { layout: structuredClone(captured.layout) as unknown as LayoutDoc, typography: structuredClone(captured.typography) as unknown as TypographyDoc };
}

type Role = 'title' | 'invitation' | 'couple' | 'godwilling' | 'details' | 'guest' | 'count';
const BODY: Role[] = ['invitation', 'couple', 'godwilling', 'details', 'guest', 'count'];

/**
 * Where a design's artwork leaves room for the pass text, in percent of its
 * pass screen. `top`/`bottom` bound the block from the couple down to the last
 * line above the QR (by default just above the QR); `below` lines sit under
 * the QR, for cards whose frame puts the QR mid-card. `skip` names lines the
 * card has no place for.
 */
export interface PassPlan {
  /** Where the title goes; left out, it stays where the design has it; null, the card has no room for one. */
  title?: number | null;
  top: number;
  bottom?: number;
  x?: number;
  width?: number;
  skip?: Role[];
  below?: Role[];
}

// Read off each card with a percentage grid over it. The blessing is printed
// on most of these cards (as it is on عروس الياسمين's), so the optional
// customer blessing is only kept where the design already had a place for it.
// Where the card prints «رمز الدعوة» over its QR frame, the guest and seats
// lines go in the lobe under the QR instead of above it.
const NO_BLESSING: Role[] = ['invitation'];
export const PASS_PLANS: Record<string, PassPlan> = {
  'ribbon-bloom-copy': { top: 25.1, bottom: 67.5 },
  'pearl-lace-copy': { top: 26.5, bottom: 69 },
  'marble-bloom-copy': { top: 28.6, bottom: 72.3 },
  'porcelain-seal-copy': { top: 26.1, bottom: 65.5 },
  'sapphire-bloom-copy': { title: 5.6, top: 21, bottom: 75, width: 62 },
  'gilded-tassel-copy': { top: 27.8, bottom: 75.5 },
  'champagne-tassel-copy': { top: 25.4, bottom: 76.6 },
  'floral-candles': { title: null, top: 29.8, bottom: 54.3, width: 52, skip: NO_BLESSING, below: ['guest', 'count'] },
  'crystal-dew': { title: null, top: 31.5, bottom: 64.5, width: 52, skip: NO_BLESSING, below: ['guest', 'count'] },
  'pearl-waves': { title: 24.5, top: 30, bottom: 66, x: 52, width: 56, skip: NO_BLESSING },
  'ivory-embossing': { title: 17, top: 24, bottom: 72.7, width: 56, skip: NO_BLESSING },
  // Its QR frame sits at a different height in each colour's art; the plan is
  // for the shared QR position and moves with each colour's.
  'floral-gulf-couple': { title: 19.5, top: 24.5, bottom: 56.4, width: 60, skip: NO_BLESSING },
  'forest-green-flowers': { title: 22.5, top: 28, bottom: 68.5, width: 60, skip: NO_BLESSING },
  'dove-velvet': { top: 26.5, bottom: 66.9, width: 66, skip: NO_BLESSING },
  'pearl-garden': { top: 24, bottom: 70.9, width: 66, skip: NO_BLESSING },
  'hibiscus-butterfly': { top: 21.4, bottom: 66.5, x: 68.5, width: 58, skip: NO_BLESSING },
};

export interface StandardDesign { family: string; layout: LayoutDoc; variants: { slug: string; overrides: LayoutOverrides; palette?: VariantPalette }[] }
export interface StandardResult { layout: LayoutDoc; variants: { slug: string; overrides: LayoutOverrides; palette?: VariantPalette }[]; removed: string[]; hidden: string[] }

/**
 * أزهار الغابة prints a dark velvet page in every colour, but its palettes
 * were dark inks meant for its ivory cards, so every flow screen was dark on
 * dark. Its page text becomes light; the cards, the seal and the form fields
 * keep exactly the dark ink they had, now stated per colour.
 */
export const DARK_PAGE_FAMILIES = ['forest-green-flowers'];
const PAGE_INK = { fg: '#FBF6EC', fgMuted: '#E8DDC8' };

function onDarkPage(layout: LayoutDoc, variants: StandardResult['variants']): { layout: LayoutDoc; variants: StandardResult['variants'] } {
  const next = { ...layout, page: { ...layout.page, overlayColor: '#000000', overlayOpacity: Math.max(layout.page.overlayOpacity, 0.18) } };
  const onCards = layout.layers.filter(l => ['cover', 'open', 'pass'].includes(l.scene) && (l.type === 'text' || l.type === 'seal'));
  const form = layout.layers.find(l => l.type === 'rsvp');
  return { layout: next, variants: variants.map(v => {
    if (!v.palette) return v;
    const old = v.palette;
    const hex = (ref: string) => ref.startsWith('@') ? (old[ref.slice(1) as keyof VariantPalette] as string | undefined) ?? ref : ref;
    const overrides = structuredClone(v.overrides);
    const keep = (id: string, key: string, colourRef: string) => {
      const current = overrides[id]?.paint as Record<string, { color?: string }> | undefined;
      if (current?.[key]?.color) return;
      overrides[id] = { ...overrides[id], paint: { ...current, [key]: { ...current?.[key], color: hex(colourRef) } } };
    };
    for (const layer of onCards) if ('style' in layer) keep(layer.id, 'style', layer.style.color);
    if (form?.type === 'rsvp') keep(form.id, 'fieldStyle', form.fieldStyle.color);
    const palette = { ...old, ...PAGE_INK, accentFg: readableInk(old.accentFg, old.accent) };
    return { ...v, palette, overrides };
  }) };
}

const STYLE_KEYS = ['style', 'titleStyle', 'numberStyle', 'labelStyle', 'timeStyle', 'itemStyle', 'fieldStyle'] as const;
const PAINT_KEYS = ['boxColor', 'boxOpacity', 'borderColor', 'background', 'backgroundOpacity', 'fieldBackground', 'accent', 'accentFg', 'fgColor'] as const;
const GEOMETRY = ['x', 'y', 'width', 'height'] as const;
const round = (n: number) => Math.round(n * 100) / 100;

function text(layer: Layer | undefined): TextLayer | undefined { return layer?.type === 'text' ? layer : undefined; }
function hasPaint(variants: StandardDesign['variants'], id: string) { return variants.some(v => v.overrides[id]?.paint); }

/**
 * The design keeps its own colour, except that where it uses the palette's
 * text or muted-text role and no colour repaints the line, it takes the
 * reference's choice between those two. Other roles mean different things in
 * different palettes (one design's `accentFg` is white), so they never move.
 */
const TEXT_ROLES = ['@fg', '@fgMuted'];
function colour(design: string, reference: string, repainted: boolean) {
  return TEXT_ROLES.includes(design) && TEXT_ROLES.includes(reference) && !repainted ? reference : design;
}

function adoptType(current: TextStyle, reference: TextStyle, repainted: boolean): TextStyle {
  return { ...reference, color: colour(current.color, reference.color, repainted) };
}

function withoutBreakpoints<T extends Layer>(layer: T): T {
  const next = { ...layer } as Record<string, unknown>;
  for (const key of ['tablet', 'desktop', 'tabletStyle', 'desktopStyle']) delete next[key];
  return next as T;
}

// ---------------------------------------------------------------------------
// Flow screens: the reference's layers, placed through the design's own column.
// ---------------------------------------------------------------------------

function flowScene(design: Layer[], reference: Layer[], standard: Layer[], variants: StandardDesign['variants']): Layer[] {
  const pairs = design.flatMap(d => {
    const s = standard.find(l => l.id === d.id);
    return s ? [{ d, s }] : [];
  });
  // How this design moved the standard's lines: y ≈ a + b·y. One line gives an offset only.
  let a = 0, b = 1;
  if (pairs.length >= 2) {
    const n = pairs.length;
    const mx = pairs.reduce((t, p) => t + p.s.base.y, 0) / n, my = pairs.reduce((t, p) => t + p.d.base.y, 0) / n;
    const sxy = pairs.reduce((t, p) => t + (p.s.base.y - mx) * (p.d.base.y - my), 0), sxx = pairs.reduce((t, p) => t + (p.s.base.y - mx) ** 2, 0);
    b = sxx > 0 ? Math.min(1.2, Math.max(0.8, sxy / sxx)) : 1;
    a = my - b * mx;
  } else if (pairs.length === 1) {
    a = pairs[0].d.base.y - pairs[0].s.base.y;
  }
  // A design whose art keeps its text to a column (flowers down one side, or
  // both) keeps the column: nothing gets wider than the widest line it has.
  const widest = Math.max(...pairs.map(p => p.d.base.width));
  const ratios = pairs.map(p => p.d.base.width / p.s.base.width).sort((p, q) => p - q);
  const constrained = pairs.some(p => Math.abs(p.d.base.x - 50) > 2) || (ratios.length > 0 && ratios[Math.floor(ratios.length / 2)] < 0.97);
  return design.map(d => {
    const r = reference.find(l => l.id === d.id && l.type === d.type);
    const s = standard.find(l => l.id === d.id);
    if (!r || !s) return withoutBreakpoints(d);
    const single = pairs.length === 1;
    const heightScale = single ? (d.base.height ?? 1) / (s.base.height ?? 1) : b;
    const width = constrained ? Math.min(widest, d.base.width * r.base.width / s.base.width) : r.base.width;
    const base: Transform = { ...r.base,
      x: round(constrained ? d.base.x + (r.base.x - s.base.x) : r.base.x),
      y: round(single ? d.base.y + (r.base.y - s.base.y) * heightScale : a + b * r.base.y),
      width: round(width),
      height: r.base.height === null ? null : round(r.base.height * heightScale) };
    if (d.type === 'rsvp' && d.base.height !== null && r.base.height !== null) {
      // The reference made its form tall enough to show the send button without
      // scrolling. Keep where this design starts it and reach as far down as the
      // reference does.
      const top = d.base.y - d.base.height / 2;
      const bottom = Math.max(d.base.y + d.base.height / 2, r.base.y + r.base.height / 2);
      Object.assign(base, { y: round((top + bottom) / 2), height: round(bottom - top) });
    }
    const next = structuredClone(r) as unknown as Record<string, unknown>;
    const current = d as unknown as Record<string, unknown>;
    Object.assign(next, { id: d.id, name: d.name, scene: d.scene, z: d.z, visible: d.visible, locked: d.locked, base });
    for (const key of PAINT_KEYS) if (key in current && key in next) next[key] = current[key];
    for (const key of STYLE_KEYS) {
      if (key in current && key in next) next[key] = adoptType(current[key] as TextStyle, next[key] as TextStyle, hasPaint(variants, d.id));
    }
    return withoutBreakpoints(next as unknown as Layer);
  });
}

/**
 * Flow screens whose background leaves the text less height than the
 * reference uses: the scene's lines are fitted between these edges.
 * أزهار الخليج's couple stands in the lower third of every screen.
 */
export const FLOW_BANDS: Record<string, Record<string, { top: number; bottom: number }>> = {
  'floral-gulf-couple': { greeting: { top: 7, bottom: 62 }, details: { top: 9, bottom: 63 } },
};

function fitBand(layers: Layer[], band: { top: number; bottom: number }): Layer[] {
  const top = Math.min(...layers.map(l => l.base.y - (l.base.height ?? 0) / 2));
  const bottom = Math.max(...layers.map(l => l.base.y + (l.base.height ?? 0) / 2));
  const k = (band.bottom - band.top) / (bottom - top);
  if (k >= 1) return layers;
  return layers.map(l => ({ ...l, base: { ...l.base, y: round(band.top + (l.base.y - top) * k), height: l.base.height === null ? null : round(l.base.height * k) } }) as Layer);
}

// ---------------------------------------------------------------------------
// Cover and open: the art decides where; the reference decides what and how.
// ---------------------------------------------------------------------------

function coverSeal(layer: SealLayer, reference: SealLayer): SealLayer {
  const blank = layer.mode === 'static' && !layer.text.trim();
  return withoutBreakpoints({ ...layer, mode: reference.mode, script: reference.script, order: reference.order, separator: reference.separator,
    maxChars: reference.maxChars, text: '',
    style: { ...reference.style, fontSize: blank ? 13 : layer.style.fontSize, color: layer.style.color } });
}

function openScene(layers: Layer[], reference: Layer[], variants: StandardDesign['variants'], canvas: { aspectW: number; aspectH: number }): Layer[] {
  const refLabel = text(reference.find(l => l.id === 'li_open_label'))!;
  const refGuest = text(reference.find(l => l.id === 'li_open_guest'))!;
  const refWelcome = text(reference.find(l => l.id === 'li_open_welcome'))!;
  const texts = layers.filter((l): l is TextLayer => l.type === 'text');
  const label = texts.find(l => l.source === 'static' && l.text.includes('دعوة خاصة'));
  const guest = texts.find(l => l.fields.includes('guestName'));
  const welcome = texts.find(l => l !== label && l !== guest);
  return layers.map(layer => {
    if (layer.type !== 'text') return layer;
    const ref = layer === label ? refLabel : layer === guest ? refGuest : layer === welcome ? refWelcome : null;
    if (!ref) return layer;
    // Room for the welcome's two lines (one for the others), grown downwards
    // from where the card's top line already sits.
    const lines = ref === refWelcome ? 2 : 1;
    const need = round(lines * ref.style.fontSize * ref.style.lineHeight / 390 * 1.08 * 100 * canvas.aspectW / canvas.aspectH);
    const height = layer.base.height ?? need;
    const base = height >= need ? layer.base : { ...layer.base, y: round(layer.base.y - height / 2 + need / 2), height: need };
    return withoutBreakpoints({ ...layer, base, source: ref.source, text: ref.text, fields: [...ref.fields],
      style: adoptType(layer.style, ref.style, hasPaint(variants, layer.id)) });
  });
}

// ---------------------------------------------------------------------------
// The entry pass.
// ---------------------------------------------------------------------------

function roleOf(layer: TextLayer): Role | 'place' | 'time' | null {
  const f = layer.fields;
  if (layer.source === 'static') {
    // A static line shows its text; any fields left on it are not drawn.
    if (layer.text.includes('بطاقة الدخول')) return 'title';
    if (layer.text.includes('{allowedCount}')) return 'count';
    if (layer.text.includes('بمشيئة الله')) return 'godwilling';
    return null;
  }
  if (f.includes('invitationText')) return 'invitation';
  if (f.includes('coupleLine') || f.includes('coupleNames')) return 'couple';
  if (f.includes('guestName')) return 'guest';
  if (f.includes('eventDate') || f.includes('eventDateShort')) return 'details';
  if (f.includes('eventTime')) return 'time';
  if (f.includes('locationFull') || f.includes('locationName')) return 'place';
  return null;
}

function effective(layer: Layer, override: LayerOverride | undefined): Transform {
  const out = { ...layer.base };
  if (override) for (const key of GEOMETRY) if (typeof override[key] === 'number') (out as Record<string, unknown>)[key] = override[key];
  return out;
}

type Placed = Record<Role, Transform & { fontSize: number }>;

// The smallest a pass line may be drawn, so a squat card never shrinks the
// reference's hierarchy into print a guest cannot read at the door.
const FLOOR: Record<Role, number> = { title: 14, invitation: 12, couple: 24, godwilling: 12, details: 14, guest: 15, count: 10 };

/**
 * Lays the reference's lines into one design's card: the couple, the
 * godwilling line, the date block, the guest and the seats line, in the
 * reference's order and hierarchy, sized to the room this artwork has. The
 * title and the blessing (an optional customer text the reference keeps
 * above the couple) sit where the card leaves them.
 */
function placePass(reference: Record<Role, TextLayer>, refCanvas: { aspectW: number; aspectH: number }, canvas: { aspectW: number; aspectH: number },
  plan: PassPlan, qr: Transform, present: Role[], kept: Partial<Record<Role, Transform>>): Partial<Placed> {
  const out: Partial<Placed> = {};
  const below = BODY.filter(r => plan.below?.includes(r) && present.includes(r));
  const block = BODY.filter(r => r !== 'invitation' && !below.includes(r) && present.includes(r));
  const qrTop = qr.y - (qr.height ?? 0) / 2, qrBottom = qr.y + (qr.height ?? 0) / 2;
  // Heights compared in stage widths, the unit type is sized in, not in percent of differently shaped canvases.
  const toW = (pct: number, c: typeof canvas) => pct / 100 * c.aspectH / c.aspectW;
  const toPct = (w: number) => w * 100 * canvas.aspectW / canvas.aspectH;
  const refBox = (r: Role) => ({ top: reference[r].base.y - (reference[r].base.height ?? 0) / 2, h: reference[r].base.height ?? 0 });
  const bottom = plan.bottom ?? qrTop - 1.5;
  const span = toW(bottom - plan.top, canvas);
  const refSpan = toW(refBox(block[block.length - 1]).top + refBox(block[block.length - 1]).h - refBox(block[0]).top, refCanvas);
  // Scale type with the room and give every line the height its text needs
  // at that size. The couple keeps two lines of room, as the reference does,
  // which is also the air around it; the seats line sits tight under the
  // guest. A cramped card lets a long couple line shrink instead of wrapping
  // before its type gets smaller; a roomy one spreads its lines evenly, up to
  // a point, and centres the block in what is left.
  let size = Math.min(1.1, span / refSpan);
  let coupleLines = 2, detailsLines = 4, floor = 1, minGap = 0.012;
  const font = (r: Role) => Math.max(FLOOR[r] * floor, reference[r].style.fontSize * size);
  const lines = (r: Role) => r === 'details' ? detailsLines : r === 'couple' ? coupleLines : r === 'invitation' ? 2 : 1;
  // Type is sized against a 390-wide stage: one line is fontSize × lineHeight / 390 stage widths.
  const height = (r: Role) => lines(r) * font(r) * reference[r].style.lineHeight / 390 * 1.06;
  const weight = (r: Role): number => r === 'count' ? 0 : r === 'godwilling' ? 0.5 : 1;
  const room = () => span - block.reduce((t, r) => t + height(r), 0) - minGap * (block.length - 1);
  if (room() < 0) coupleLines = 1.25;
  while (room() < 0 && size > 0.62) size -= 0.02;
  // The smallest cards: one line for the couple, the lines touching, and at most a tenth off the floors.
  if (room() < 0) { coupleLines = 1; minGap = 0.003; }
  while (room() < 0 && floor > 0.9) floor -= 0.01;
  // A card with room to spare holds a fifth line in the date block, for a
  // venue long enough to wrap, instead of scrolling it out of sight.
  const fifth = height('details') / 4;
  if (room() > fifth * 1.6) detailsLines = 5;
  const weights = block.slice(1).map(weight);
  const weightTotal = weights.reduce((t, w) => t + w, 0);
  const extraPerWeight = weightTotal > 0 ? Math.min(Math.max(0, room()) / weightTotal, 0.06) : 0;
  const gaps = weights.map(w => (w === 0 ? 0 : minGap) + w * extraPerWeight);
  const used = block.reduce((t, r) => t + height(r), 0) + gaps.reduce((t, g) => t + g, 0);
  const width = plan.width ?? 68;
  const x = plan.x ?? 50;
  const put = (r: Role, top: number, h: number, at: Partial<Transform> = {}) => {
    out[r] = { ...reference[r].base, x, width: round(r === 'details' ? width + 1 : width), ...at, y: round(top + h / 2), height: round(h),
      fontSize: round(font(r)) };
  };
  let cursor = plan.top + toPct(Math.max(0, span - used) / 2);
  block.forEach((r, i) => {
    const h = toPct(height(r));
    put(r, cursor, h);
    cursor += h + (i < gaps.length ? toPct(gaps[i]) : 0);
  });
  cursor = qrBottom + 0.8;
  for (const r of below) { const h = toPct(height(r)); put(r, cursor, h); cursor += h * 0.85; }
  if (present.includes('title') && plan.title !== null) {
    const was = kept.title;
    const h = toPct(height('title'));
    put('title', plan.title! - h / 2, h, was ? { x: was.x, width: was.width } : {});
  }
  if (present.includes('invitation')) {
    const was = kept.invitation;
    const h = toPct(height('invitation'));
    if (was) put('invitation', was.y - (was.height ?? h) / 2, was.height ?? h, { x: was.x, width: was.width });
    else put('invitation', plan.top - h, h);
  }
  return out;
}

function passScene(design: StandardDesign, layers: Layer[], ref: LayoutDoc, removed: string[], hidden: string[]): { layers: Layer[]; overrides: LayoutOverrides[] } {
  const plan = PASS_PLANS[design.family];
  const refLayers = ref.layers.filter(l => l.scene === 'pass');
  const refRoles = Object.fromEntries(refLayers.flatMap(l => { const t = text(l); const r = t && roleOf(t); return r && BODY.concat('title').includes(r as Role) ? [[r, t]] : []; })) as Record<Role, TextLayer>;
  const qr = layers.find(l => l.type === 'qr');
  if (!plan || !qr) return { layers, overrides: design.variants.map(v => v.overrides) };
  const canvas = design.layout.scenes.find(s => s.id === 'pass')!.canvas;
  const refCanvas = ref.scenes.find(s => s.id === 'pass')!.canvas;

  // Find what the design already has, merge the date, time and place into one block.
  const byRole = new Map<Role, TextLayer>();
  const next: Layer[] = [];
  for (const layer of layers) {
    const t = text(layer);
    const role = t && roleOf(t);
    if (!t || !role) {
      if (t && t.visible) { hidden.push(`${design.family}:${t.id}`); next.push({ ...t, visible: false }); } else next.push(layer);
      continue;
    }
    if (role === 'place' || role === 'time' || byRole.has(role as Role)) { removed.push(`${design.family}:${t.id}`); continue; }
    byRole.set(role as Role, t);
    next.push(t);
  }
  const skip = new Set(plan.skip ?? []);
  const wanted = (['title', ...BODY] as Role[]).filter(r => !skip.has(r) && !(r === 'title' && plan.title === null));
  // Where the artwork already put the title and the blessing, before anything moves.
  const original = new Map([...byRole].map(([role, layer]) => [role, { ...layer.base }]));
  // New lines copy the colour of the line that plays the same part on this card.
  const muted = byRole.get('title') ?? byRole.get('godwilling') ?? byRole.get('invitation') ?? byRole.get('details') ?? byRole.get('couple');
  const strong = byRole.get('couple') ?? byRole.get('guest') ?? byRole.get('details');
  const sibling = new Map<string, string>();
  let z = Math.max(...next.filter(l => l.scene === 'pass').map(l => l.z)) + 1;
  for (const role of wanted) {
    if (byRole.has(role)) continue;
    const r = refRoles[role];
    const like = r.style.color === '@fgMuted' ? muted : strong;
    const layer: TextLayer = { ...structuredClone(r), id: r.id, z: z++, locked: false, visible: true,
      style: { ...r.style, color: like?.style.color ?? r.style.color } };
    if (like) sibling.set(layer.id, like.id);
    byRole.set(role, layer);
    next.push(layer);
  }
  for (const [role, layer] of byRole) {
    if (!wanted.includes(role)) {
      if (layer.visible) hidden.push(`${design.family}:${layer.id}`);
      layer.visible = false;
      continue;
    }
    const r = refRoles[role];
    const repainted = hasPaint(design.variants, layer.id) || (sibling.has(layer.id) && hasPaint(design.variants, sibling.get(layer.id)!));
    Object.assign(layer, withoutBreakpoints({ ...layer, source: r.source, text: r.text, fields: [...r.fields], style: adoptType(layer.style, r.style, repainted) }));
  }
  // The seats line is the reference's small dark line under the guest; in
  // other palettes the role it uses is not dark, so it follows the guest's ink.
  const guest = byRole.get('guest'), count = byRole.get('count');
  if (guest && count && count.visible) {
    count.style = { ...count.style, color: guest.style.color };
    sibling.set(count.id, guest.id);
  }

  const placeFor = (overrides: LayoutOverrides) => {
    const q = effective(qr, overrides[qr.id]);
    const shift = q.y - qr.base.y;
    const kept: Partial<Record<Role, Transform>> = {};
    for (const role of ['title', 'invitation'] as Role[]) {
      const layer = byRole.get(role), was = original.get(role);
      if (layer && was && !sibling.has(layer.id)) kept[role] = effective({ ...layer, base: was } as Layer, overrides[layer.id]);
    }
    const titleY = plan.title === null ? null : plan.title === undefined ? (kept.title?.y ?? null) : plan.title + shift;
    return placePass(refRoles, refCanvas, canvas, { ...plan, title: titleY, top: plan.top + shift, bottom: plan.bottom === undefined ? undefined : plan.bottom + shift },
      q, wanted, kept);
  };
  const basePlaced = placeFor({});
  for (const [role, layer] of byRole) {
    const p = basePlaced[role];
    if (!p) continue;
    const { fontSize, ...base } = p;
    layer.base = { ...layer.base, ...base, scale: 1, rotation: 0 };
    layer.style = { ...layer.style, fontSize };
  }
  const overrides = design.variants.map(variant => {
    const copy: LayoutOverrides = structuredClone(variant.overrides);
    for (const id of Object.keys(copy)) if (removed.includes(`${design.family}:${id}`)) delete copy[id];
    for (const [child, parent] of sibling) if (copy[parent]?.paint) copy[child] = { ...copy[child], paint: structuredClone(copy[parent]!.paint) };
    const placed = placeFor(variant.overrides);
    for (const [role, layer] of byRole) {
      const entry = copy[layer.id];
      const p = placed[role];
      if (entry) for (const key of GEOMETRY) delete entry[key];
      if (p) {
        const diff: Partial<Transform> = {};
        for (const key of GEOMETRY) if (Math.abs((p[key] ?? 0) - (layer.base[key] ?? 0)) > 0.01) (diff as Record<string, unknown>)[key] = p[key];
        if (Object.keys(diff).length) copy[layer.id] = { ...copy[layer.id], ...diff };
      }
      if (copy[layer.id] && Object.keys(copy[layer.id]!).length === 0) delete copy[layer.id];
    }
    return copy;
  });
  return { layers: next, overrides };
}

// ---------------------------------------------------------------------------

export function applyJasmineStandard(design: StandardDesign, reference = jasmineReference().layout): StandardResult {
  const doc = structuredClone(design.layout);
  const removed: string[] = [], hidden: string[] = [];
  const standard = standardFlowLayers();
  const refSeal = reference.layers.find((l): l is SealLayer => l.type === 'seal')!;
  doc.animation = structuredClone(reference.animation);
  const order = reference.scenes.map(s => s.id);
  doc.scenes = [...doc.scenes].sort((p, q) => (order.indexOf(p.id) + 1 || 99) - (order.indexOf(q.id) + 1 || 99))
    .map(s => { const r = reference.scenes.find(x => x.id === s.id); return r ? { ...s, name: r.name, visible: r.visible, requires: r.requires } : s; });

  let layers = doc.layers.map(l => l.type === 'seal' && l.scene === 'cover' ? coverSeal(l, refSeal) : l);
  const open = openScene(layers.filter(l => l.scene === 'open'), reference.layers.filter(l => l.scene === 'open'), design.variants,
    doc.scenes.find(s => s.id === 'open')!.canvas);
  layers = layers.map(l => open.find(o => o.id === l.id) ?? l);
  for (const scene of doc.scenes.filter(s => s.role === 'flow' && s.id !== 'open')) {
    let placed = flowScene(layers.filter(l => l.scene === scene.id), reference.layers.filter(l => l.scene === scene.id), standard, design.variants);
    const band = FLOW_BANDS[design.family]?.[scene.id];
    if (band && placed.length) placed = fitBand(placed, band);
    layers = layers.map(l => placed.find(p => p.id === l.id) ?? l);
  }
  const pass = passScene({ ...design, layout: doc }, layers.filter(l => l.scene === 'pass'), reference, removed, hidden);
  layers = [...layers.filter(l => l.scene !== 'pass'), ...pass.layers];
  doc.layers = layers;
  const variants = design.variants.map((v, i) => ({ slug: v.slug, overrides: pass.overrides[i], palette: v.palette }));
  if (DARK_PAGE_FAMILIES.includes(design.family)) {
    const dark = onDarkPage(doc, variants);
    return { layout: dark.layout, variants: dark.variants, removed, hidden };
  }
  return { layout: doc, variants, removed, hidden };
}

/** What a brand-new design opens with when the live reference cannot be read: the committed copy, whole. */
export function jasmineNewDesignLayout(): LayoutDoc {
  return jasmineReference().layout;
}
