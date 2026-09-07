import type { ContentField, LayoutDoc, TextLayer } from "@/lib/themes/builder/types";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

export const RIBBON_THEME_SLUG = "ribbon-bloom-copy";

/** An explicit editor operation, never a loader migration or render override. */
const BLOCKS = [
  { id: "f_greeting_opening", fields: ["opening"], y: 18, width: 76, height: 19,
    font: "Amiri", size: 19, weight: 400, leading: 1.6 },
  { id: "f_greeting_host", fields: ["hostLine", "inviteVerb"], y: 36, width: 76, height: 15,
    font: "IBM Plex Sans Arabic", size: 18, weight: 400, leading: 1.6 },
  { id: "f_greeting_couples", fields: ["coupleLine"], y: 51, width: 78, height: 14,
    font: "Aref Ruqaa", size: 40, weight: 700, leading: 1.3 },
  { id: "f_greeting_inshallah", fields: ["inshallah"], y: 62, width: 76, height: 5,
    font: "IBM Plex Sans Arabic", size: 18, weight: 400, leading: 1.5 },
  { id: "f_greeting_date", fields: ["eventDate"], y: 71, width: 76, height: 13,
    font: "IBM Plex Sans Arabic", size: 18, weight: 500, leading: 1.5 },
] as const;

export const RIBBON_GREETING_IDS: readonly string[] = BLOCKS.map((block) => block.id);
type Proposal = { ok: true; layout: LayoutDoc } | { ok: false; reason: string };

/**
 * Restyle only a recognised, editable five-layer greeting. Existing custom
 * bindings, breakpoint layouts and colour-specific positions need a human
 * review; silently removing them would make this preset destructive.
 * Literal per-layer fonts remain normal InspectorPanel values. Other scenes,
 * palette/paint, images, QR, animation and the shared typography stay intact.
 */
export function proposeRibbonGreeting(
  themeSlug: string,
  doc: LayoutDoc,
  variantOverrides: readonly LayoutOverrides[] = [],
): Proposal {
  if (themeSlug !== RIBBON_THEME_SLUG) return { ok: false, reason: "هذا التنسيق مخصص لفيونكة الورد." };
  const scene = doc.scenes.find((entry) => entry.id === "greeting");
  if (!scene?.visible || scene.role !== "flow" || scene.canvas.aspectW !== 390 || scene.canvas.aspectH !== 620) {
    return { ok: false, reason: "مقاس شاشة الترحيب أو إعدادها مخصص؛ يلزم مراجعته يدويًا." };
  }
  if (BLOCKS.some((block) => 50 - block.width / 2 < scene.canvas.safeInset ||
    block.y - block.height / 2 < scene.canvas.safeInset || block.y + block.height / 2 > 100 - scene.canvas.safeInset)) {
    return { ok: false, reason: "المنطقة الآمنة مخصصة؛ لم نضع النصوص خارج حدودها." };
  }
  if (doc.layers.some((layer) => layer.scene === "greeting" && !RIBBON_GREETING_IDS.includes(layer.id))) {
    return { ok: false, reason: "توجد عناصر إضافية في شاشة الترحيب؛ لم نغيّرها لتجنّب التداخل." };
  }
  for (const block of BLOCKS) {
    const matches = doc.layers.filter((layer) => layer.id === block.id);
    const layer = matches[0];
    if (matches.length !== 1 || layer.type !== "text" || layer.scene !== "greeting" ||
      layer.source !== "content" || !layer.visible || layer.locked) {
      return { ok: false, reason: "إحدى طبقات الترحيب محذوفة أو مقفلة أو مخصصة؛ يلزم مراجعتها يدويًا." };
    }
    const fields = layer.fields.filter((field) => !(block.id === "f_greeting_date" && field === "eventTime"));
    if (JSON.stringify(fields) !== JSON.stringify(block.fields)) {
      return { ok: false, reason: "توجد روابط بيانات مخصصة؛ لم نغيّرها أو نستبدلها." };
    }
    if ([layer.tablet, layer.desktop, layer.tabletStyle, layer.desktopStyle].some((value) => value && Object.keys(value).length)) {
      return { ok: false, reason: "توجد إعدادات مخصصة لمقاسات أخرى؛ يلزم مراجعتها قبل التنسيق المشترك." };
    }
    for (const overrides of variantOverrides) {
      const own = overrides[block.id];
      if (own && Object.keys(own).some((key) => key !== "paint")) {
        return { ok: false, reason: "أحد الألوان له مواقع خاصة لنصوص الترحيب؛ لم نغيّرها أو نحذفها." };
      }
    }
  }
  const layers = doc.layers.map((layer) => {
    const block = BLOCKS.find((entry) => entry.id === layer.id);
    if (!block || layer.type !== "text") return layer;
    const fields: ContentField[] = block.id === "f_greeting_date"
      ? [...layer.fields.filter((field) => field !== "eventTime"), "eventTime"] : [...layer.fields];
    return {
      ...layer, fields,
      base: { ...layer.base, x: 50, y: block.y, width: block.width, height: block.height, scale: 1, rotation: 0, opacity: 1 },
      style: { ...layer.style, font: block.font, fontSize: block.size, fontWeight: block.weight,
        lineHeight: block.leading, letterSpacing: 0, align: "center", color: "@fg" },
    } satisfies TextLayer;
  });
  return { ok: true, layout: { ...doc, layers } };
}
