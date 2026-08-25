import { slotLabelAr } from "@/lib/themes/builder/slots";
import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  type Layer,
  type LayerType,
  type SceneId,
} from "@/lib/themes/builder/types";

/**
 * Sensible starting geometry per layer type. A new element should land
 * somewhere usable and visible — dropping everything at 80% width in the dead
 * centre makes the first drag a correction rather than a placement.
 */
export function createLayer(type: LayerType, scene: SceneId, z: number, slot?: string): Layer {
  const id = `l_${crypto.randomUUID().slice(0, 8)}`;

  switch (type) {
    case "asset":
      return {
        id,
        type: "asset",
        name: slot ? slotLabelAr(slot) : "صورة",
        slot: slot ?? "decoration",
        fit: slot === "background" ? "cover" : "contain",
        scene,
        z,
        visible: true,
        locked: false,
        base:
          slot === "background"
            ? { ...DEFAULT_TRANSFORM, width: 100, height: 100 }
            : { ...DEFAULT_TRANSFORM, width: 82 },
      };

    case "text":
      return {
        id,
        type: "text",
        name: "نص",
        scene,
        z,
        visible: true,
        locked: false,
        source: "content",
        text: "",
        fields: ["guestName"],
        style: { ...DEFAULT_TEXT_STYLE, fontSize: 18, font: "@display" },
        base: { ...DEFAULT_TRANSFORM, width: 60, height: 12, y: 40 },
      };

    case "seal":
      return {
        id,
        type: "seal",
        name: "أحرف الختم",
        scene,
        z,
        visible: true,
        locked: false,
        mode: "initials",
        script: "latin",
        order: "groom-first",
        text: "",
        separator: "&",
        maxChars: 1,
        style: { ...DEFAULT_TEXT_STYLE, font: "@latin", fontSize: 14, letterSpacing: 0.05 },
        base: { ...DEFAULT_TRANSFORM, width: 16, height: 6, y: 62 },
      };

    case "qr":
      return {
        id,
        type: "qr",
        name: "الباركود",
        scene,
        z,
        visible: true,
        locked: false,
        padding: 6,
        borderRadius: 8,
        background: "#FFFFFF",
        borderColor: "#000000",
        borderWidth: 0,
        fgColor: "#000000",
        base: { ...DEFAULT_TRANSFORM, width: 24, height: 16, y: 72 },
      };
  }
}
