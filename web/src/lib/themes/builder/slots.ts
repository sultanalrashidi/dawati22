/**
 * Asset slot registry.
 *
 * A slot is just a string key an `AssetLayer` points at; the renderer looks it
 * up in the *variant's* asset map, which is what makes "same layout, different
 * color images" work. The list below is the curated set the editor offers by
 * name — but `ThemeAsset.slot` is a free-form column and the renderer resolves
 * any key, so an admin can add "bisht", "bouquet", "music-icon" or anything
 * else later without a schema change or a deploy.
 */

import type { SceneId } from "./types";

export interface SlotDefinition {
  key: string;
  labelAr: string;
  labelEn: string;
  /** Publishing is blocked without this slot filled on the default variant. */
  required: boolean;
  /**
   * Which scene the editor drops a new layer for this slot into. A scene id,
   * not a closed set — an admin can add and rename scenes, so this is only a
   * sensible starting scene, resolved against the document at drop time.
   */
  scene: SceneId;
  hintAr: string;
}

export const CORE_SLOTS: SlotDefinition[] = [
  {
    key: "background",
    labelAr: "خلفية التصميم",
    labelEn: "Theme Background",
    required: true,
    scene: "cover",
    hintAr: "الخلفية الأساسية التي تملأ الشاشة خلف كل العناصر",
  },
  {
    key: "envelopeClosed",
    labelAr: "الظرف المغلق",
    labelEn: "Closed Envelope",
    required: true,
    scene: "cover",
    hintAr: "صورة الظرف قبل الفتح — أول ما يشوفه المدعو",
  },
  {
    key: "envelopeOpen",
    labelAr: "الظرف المفتوح",
    labelEn: "Open Envelope",
    required: true,
    scene: "open",
    hintAr: "الظرف بعد الفتح وفي داخله البطاقة",
  },
  {
    key: "card",
    labelAr: "بطاقة الدعوة",
    labelEn: "Invitation Card",
    required: true,
    scene: "pass",
    hintAr: "بطاقة الدخول التي تظهر بعد قبول الدعوة",
  },
];

export const OPTIONAL_SLOTS: SlotDefinition[] = [
  {
    key: "cardNoQr",
    labelAr: "بطاقة الدعوة (بدون باركود)",
    labelEn: "Invitation Card (No QR)",
    required: false,
    scene: "pass",
    hintAr:
      "تُستخدم تلقائيًا بدل «بطاقة الدعوة» لأي دعوة بيعت بدون باركود. اتركها فاضية لتبقى نفس بطاقة الدعوة الأساسية.",
  },
  { key: "seal", labelAr: "الختم", labelEn: "Seal", required: false, scene: "cover", hintAr: "صورة الختم التي تُطبع فوقها أحرف العروسين" },
  { key: "overlay", labelAr: "طبقة فوقية", labelEn: "Overlay", required: false, scene: "cover", hintAr: "تدرّج أو زجاج فوق التصميم" },
  { key: "decoration", labelAr: "زخرفة", labelEn: "Decoration", required: false, scene: "cover", hintAr: "أي عنصر زخرفي إضافي" },
  { key: "flowers", labelAr: "ورد", labelEn: "Flowers", required: false, scene: "cover", hintAr: "" },
  { key: "dress", labelAr: "فستان العروس", labelEn: "Bridal Dress", required: false, scene: "cover", hintAr: "" },
  { key: "bisht", labelAr: "البشت", labelEn: "Bisht", required: false, scene: "cover", hintAr: "" },
  { key: "musicIcon", labelAr: "أيقونة الموسيقى", labelEn: "Music Icon", required: false, scene: "cover", hintAr: "" },
];

export const ALL_SLOTS: SlotDefinition[] = [...CORE_SLOTS, ...OPTIONAL_SLOTS];

const BY_KEY = new Map(ALL_SLOTS.map((s) => [s.key, s]));

export function slotDefinition(key: string): SlotDefinition | undefined {
  return BY_KEY.get(key);
}

/** Arabic label for a slot key, falling back to the key itself for custom slots. */
export function slotLabelAr(key: string): string {
  return BY_KEY.get(key)?.labelAr ?? key;
}

export const REQUIRED_SLOT_KEYS = CORE_SLOTS.filter((s) => s.required).map((s) => s.key);

/** A custom slot key an admin types must be safe to use in a blob path. */
export const SLOT_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]{0,39}$/;
