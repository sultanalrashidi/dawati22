import { defaultFlowLayers, defaultSceneList } from "@/lib/themes/builder/default-flow";
import {
  BUILDER_SCHEMA_VERSION,
  DEFAULT_ANIMATION,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  type Layer,
  type LayoutDoc,
} from "@/lib/themes/builder/types";

/**
 * The layout a brand-new theme starts from.
 *
 * An empty canvas is the wrong default: every invitation needs the same set of
 * elements in roughly the same places, and asking an admin to rebuild that list
 * from scratch for each design is busywork they'd get subtly wrong. So a new
 * theme opens with the standard elements already placed and wired to the real
 * invitation fields — the admin uploads the art, nudges positions to suit it,
 * and is done.
 *
 * Positions are deliberate but generic: centred, inside the safe area, sized
 * for the default 390x620 stage. They are a starting point to drag, not a
 * guess at any particular artwork.
 */

/** Stable ids so a starter layer stays recognisable after edits. */
function layer(partial: Layer): Layer {
  return partial;
}

export function starterLayoutDoc(): LayoutDoc {
  const layers: Layer[] = [
    // --- Scene 1: the closed envelope -------------------------------------
    layer({
      id: "s_cover_envelope",
      type: "asset",
      name: "الظرف المغلق",
      slot: "envelopeClosed",
      fit: "contain",
      scene: "cover",
      z: 0,
      visible: true,
      locked: false,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 86, height: null },
    }),
    layer({
      id: "s_cover_seal",
      type: "seal",
      name: "أحرف العروسين",
      scene: "cover",
      z: 1,
      visible: true,
      locked: false,
      mode: "initials",
      script: "latin",
      order: "groom-first",
      text: "",
      separator: "&",
      maxChars: 1,
      style: { ...DEFAULT_TEXT_STYLE, font: "@latin", fontSize: 15, letterSpacing: 0.06, color: "#5C4526" },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 57, width: 20, height: 6 },
    }),

    // --- Scene 2: the opened card -----------------------------------------
    layer({
      id: "s_open_envelope",
      type: "asset",
      name: "الظرف المفتوح",
      slot: "envelopeOpen",
      fit: "contain",
      scene: "open",
      z: 0,
      visible: true,
      locked: false,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 92, height: null },
    }),
    layer({
      id: "s_open_guest_label",
      type: "text",
      name: "سطر «دعوة خاصة إلى»",
      scene: "open",
      z: 1,
      visible: true,
      locked: false,
      source: "static",
      text: "دعوة خاصة إلى",
      fields: [],
      style: { ...DEFAULT_TEXT_STYLE, font: "@body", fontSize: 10, letterSpacing: 0.25, color: "#8C7248" },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 36, width: 56, height: 5 },
    }),
    layer({
      id: "s_open_guest_name",
      type: "text",
      name: "اسم المدعو",
      scene: "open",
      z: 2,
      visible: true,
      locked: false,
      source: "content",
      fields: ["guestName"],
      text: "",
      style: { ...DEFAULT_TEXT_STYLE, font: "@display", fontSize: 20, color: "#5C4526", lineHeight: 1.4 },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 43, width: 60, height: 9 },
    }),
    layer({
      id: "s_open_invitation_text",
      type: "text",
      name: "الدعوة كاملة",
      scene: "open",
      z: 3,
      visible: true,
      locked: false,
      source: "content",
      // The whole composed invitation (host line, verb, couple line): the
      // free `invitationText` is optional now and empty by default.
      fields: ["inviteLine"],
      text: "",
      style: { ...DEFAULT_TEXT_STYLE, font: "@body", fontSize: 11, color: "#8C7248", lineHeight: 1.8 },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 56, width: 58, height: 14 },
    }),

    // --- Scene 3: the entry pass ------------------------------------------
    layer({
      id: "s_pass_card",
      type: "asset",
      name: "بطاقة الدخول",
      slot: "card",
      fit: "contain",
      scene: "pass",
      z: 0,
      visible: true,
      locked: false,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 92, height: null },
    }),
    layer({
      id: "s_pass_couple",
      type: "text",
      name: "أسماء العروسين",
      scene: "pass",
      z: 1,
      visible: true,
      locked: false,
      source: "content",
      fields: ["coupleNames"],
      text: "",
      style: { ...DEFAULT_TEXT_STYLE, font: "@display", fontSize: 15, color: "#5C4526", lineHeight: 1.6 },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 28, width: 64, height: 12 },
    }),
    layer({
      id: "s_pass_details",
      type: "text",
      name: "التاريخ والموقع",
      scene: "pass",
      z: 2,
      visible: true,
      locked: false,
      source: "content",
      fields: ["eventDate", "eventTime", "locationName"],
      text: "",
      style: { ...DEFAULT_TEXT_STYLE, font: "@body", fontSize: 10, color: "#8C7248", lineHeight: 1.9 },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 45, width: 62, height: 12 },
    }),
    layer({
      id: "s_pass_qr",
      type: "qr",
      name: "الباركود",
      scene: "pass",
      z: 3,
      visible: true,
      locked: false,
      padding: 6,
      borderRadius: 8,
      background: "#FFFFFF",
      borderColor: "#000000",
      borderWidth: 0,
      fgColor: "#1A1A1A",
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 71, width: 26, height: 17 },
    }),
    layer({
      id: "s_pass_guest",
      type: "text",
      name: "اسم المدعو",
      scene: "pass",
      z: 4,
      visible: true,
      locked: false,
      source: "content",
      fields: ["guestName"],
      text: "",
      style: { ...DEFAULT_TEXT_STYLE, font: "@body", fontSize: 11, color: "#5C4526" },
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 84, width: 60, height: 6 },
    }),
  ];

  return {
    version: BUILDER_SCHEMA_VERSION,
    page: { ...DEFAULT_PAGE_BACKGROUND },
    // The full invitation, not just the three art screens: a new theme opens
    // with every screen a guest will see, each already wired to real data.
    scenes: defaultSceneList(),
    layers: [...layers, ...defaultFlowLayers()],
    animation: DEFAULT_ANIMATION,
  };
}
