/**
 * The entry pass of an invitation sold without a barcode.
 *
 * By default such an invitation shows the design's ordinary pass with its `qr`
 * layers dropped (see ThemeStage) and the "cardNoQr" art swapped in (see
 * `stageAssetUrl`) — the same arrangement, with a hole where the code was. A
 * design can instead carry a scene of its own for it, role `passNoQr`, which
 * the owner arranges in the editor like any other screen: the name moved up
 * into the space, a bigger seat count, a line taken out.
 *
 * That scene starts life as a copy of the pass (`withNoQrPass`), so creating
 * it changes nothing a guest sees until someone actually rearranges it.
 */

import type { LayoutOverrides } from "./resolve";
import { SCENE_PASS_NO_QR, type LayoutDoc, type SceneDef, type SceneId } from "./types";

/** What the new scene is called on the editor's tabs. */
export const NO_QR_PASS_NAME = "بطاقة بدون باركود";

/** `layoutDocSchema` refuses more than these. */
const MAX_SCENES = 30;
const MAX_LAYERS = 120;
const MAX_ID_LENGTH = 64;

/**
 * The pass this guest is shown once they accept.
 *
 * With a barcode it is only ever the ordinary pass. Without one it is the
 * design's own no-barcode pass when it has a visible one, and the ordinary pass
 * otherwise — hiding that scene in the editor is how the owner goes back to the
 * automatic card without deleting their arrangement.
 */
export function passSceneFor(layout: LayoutDoc, hasQr: boolean): SceneDef | undefined {
  const pass = layout.scenes.find((scene) => scene.role === "pass" && scene.visible);
  if (hasQr) return pass;
  return layout.scenes.find((scene) => scene.role === "passNoQr" && scene.visible) ?? pass;
}

export type NoQrPassRefusal = "exists" | "noPass" | "full";

export interface NoQrPassCopy {
  doc: LayoutDoc;
  sceneId: SceneId;
  /** Each copied layer's source id → its copy's id, so every colour's own tweaks can follow. */
  layerIds: Map<string, string>;
}

/** An id beside `base` that nothing in `taken` uses yet. */
function freshId(base: string, suffix: string, taken: Set<string>): string {
  const stem = base.slice(0, MAX_ID_LENGTH - suffix.length - 3);
  let candidate = `${stem}${suffix}`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${stem}${suffix}${n}`;
  return candidate;
}

/**
 * The document with a no-barcode pass added: the ordinary pass's canvas and
 * every layer on it except the code, under new ids. The card image keeps its
 * "card" slot on purpose — an invitation without a barcode already resolves
 * that slot to the colour's "cardNoQr" art when there is one, and to the
 * ordinary card when there is not, so pointing the copy at "cardNoQr" directly
 * would leave a blank card on every colour that never got that upload.
 */
export function withNoQrPass(doc: LayoutDoc): NoQrPassCopy | { error: NoQrPassRefusal } {
  if (doc.scenes.some((scene) => scene.role === "passNoQr")) return { error: "exists" };
  const pass = doc.scenes.find((scene) => scene.role === "pass");
  if (!pass) return { error: "noPass" };

  const source = doc.layers.filter((layer) => layer.scene === pass.id && layer.type !== "qr");
  if (doc.scenes.length >= MAX_SCENES || doc.layers.length + source.length > MAX_LAYERS) {
    return { error: "full" };
  }

  const sceneId = freshId(SCENE_PASS_NO_QR, "", new Set(doc.scenes.map((scene) => scene.id)));
  const taken = new Set(doc.layers.map((layer) => layer.id));
  const layerIds = new Map<string, string>();
  const copies = source.map((layer) => {
    const id = freshId(layer.id, "-noqr", taken);
    taken.add(id);
    layerIds.set(layer.id, id);
    return { ...structuredClone(layer), id, scene: sceneId };
  });

  const scene: SceneDef = {
    id: sceneId,
    name: NO_QR_PASS_NAME,
    role: "passNoQr",
    canvas: { ...pass.canvas },
    visible: true,
    requires: null,
  };

  return {
    doc: { ...doc, scenes: [...doc.scenes, scene], layers: [...doc.layers, ...copies] },
    sceneId,
    layerIds,
  };
}

/**
 * One colour's overrides with each copied layer given its source's entry, so a
 * colour that nudged or recoloured something on its pass gets the same on the
 * copy. Null when the colour had nothing on those layers — nothing to write.
 */
export function copyLayerOverrides(
  overrides: LayoutOverrides,
  layerIds: Map<string, string>,
): LayoutOverrides | null {
  let out: LayoutOverrides | null = null;
  for (const [from, to] of layerIds) {
    const entry = overrides[from];
    if (!entry) continue;
    out ??= { ...overrides };
    out[to] = structuredClone(entry);
  }
  return out;
}
