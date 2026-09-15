"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_CANVAS,
  DEFAULT_TRANSFORM,
  SCENE_COVER,
  type Breakpoint,
  type Layer,
  type LayoutDoc,
  type PageBackground,
  type SceneCanvas,
  type SceneDef,
  type SceneId,
  type TextStyleOverride,
  type Transform,
  type TransformOverride,
  type AnimationSettings,
  colorRoleOf,
} from "@/lib/themes/builder/types";

/** Per-layer colour patches for one variant: `{ [layerId]: { style: { color } } }`. */
export type VariantPaint = Record<string, Record<string, unknown>>;

/**
 * Position and size this ONE colour changes about a layer, keyed by layer id.
 *
 * Separate from the paint map because they are stored side by side in the same
 * per-variant record but mean different things, and because only one of them
 * has a scope switch in the toolbar.
 */
export type VariantGeometry = Record<string, TransformOverride>;

/**
 * Where a drag lands.
 *
 * `all` writes the layout document, which every colour of the design shares —
 * the right default, because most designs want one arrangement. `variant`
 * writes only the colour on screen, which is what a family whose colours use
 * slightly different photographs needs: moving the monogram on the navy card
 * should not move it on the ivory one.
 */
export type TransformScope = "all" | "variant";

/** Same deep merge the renderer uses, so the editor previews it exactly. */
function applyPaint<T>(layer: T, patch: Record<string, unknown>): T {
  const out = { ...(layer as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)
        ? applyPaint(current as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return out as T;
}

const HISTORY_LIMIT = 60;

/** `layoutDocSchema` refuses to store more than this. */
const MAX_SCENES = 30;

/** The editable half of a scene — its canvas has its own patcher. */
export type SceneDefPatch = Partial<Pick<SceneDef, "name" | "role" | "visible" | "requires">>;

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Arabic-Indic digits, for counts printed inside Arabic copy. Lives here
 * because the scene tabs, the scene manager and the generated scene names all
 * number the same list and must agree on how a number looks.
 */
export function arabicNumber(value: number): string {
  return String(value).replace(/\d/g, (digit) => AR_DIGITS[Number(digit)]);
}

/** The scene the editor should open on: the cover, or whatever comes first. */
function firstScene(doc: LayoutDoc): SceneId {
  return (doc.scenes.find((s) => s.role === "cover") ?? doc.scenes[0])?.id ?? SCENE_COVER;
}

/** A fresh scene id that collides with nothing already in the document. */
function uniqueSceneId(doc: LayoutDoc): SceneId {
  for (;;) {
    const candidate = `s_${crypto.randomUUID().slice(0, 8)}`;
    if (!doc.scenes.some((scene) => scene.id === candidate)) return candidate;
  }
}

/**
 * Editor state for one layout document.
 *
 * Two update paths on purpose. Dragging calls `patchTransform` many times per
 * second and must not fill the undo stack with a hundred intermediate frames,
 * so the interaction snapshots once at pointer-down (`beginInteraction`) and
 * writes live afterwards. Everything else — a numeric field, a toggle, adding a
 * layer — snapshots per change, which is what makes undo feel right.
 */
/**
 * The layer properties that are a COLOUR, and therefore belong to the variant
 * the admin is looking at rather than to the design they all share.
 *
 * Everything else in a layer — where it sits, what it says, how big it is — is
 * the design itself and stays in the one shared document.
 */
const COLOR_KEYS: ReadonlySet<string> = new Set([
  "color",
  "background",
  "backgroundColor",
  "borderColor",
  "boxColor",
  "fgColor",
  "overlayColor",
  "fieldBackground",
  "accent",
  "accentFg",
]);

/**
 * Splits a patch into the colours (variant-owned) and the rest (shared).
 *
 * Recurses into nested style objects, because the inspector patches a whole
 * `titleStyle` at once — the colour inside it has to be peeled off, or a
 * countdown's heading colour would still be written to the shared design.
 */
function splitColors<T extends Record<string, unknown>>(patch: T): { colors: Record<string, unknown>; rest: T } {
  const colors: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (COLOR_KEYS.has(key)) {
      colors[key] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = splitColors(value as Record<string, unknown>);
      if (Object.keys(nested.colors).length > 0) colors[key] = nested.colors;
      if (Object.keys(nested.rest).length > 0) rest[key] = nested.rest;
    } else {
      rest[key] = value;
    }
  }
  return { colors, rest: rest as T };
}

/** A breakpoint style without its colour; `undefined` when nothing is left. */
function stripColor(style: TextStyleOverride): TextStyleOverride | undefined {
  const { color: _color, ...rest } = style;
  void _color;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * A text/seal layer without its per-size colours. A colour applies at every
 * size (the inspector says so), and a tablet/desktop colour left behind would
 * shadow both the base style and the variant's own paint at that size — so
 * choosing ANY colour lifts them, whether or not the base itself changed.
 * Returns the same object when there is nothing to lift.
 */
function liftSizedInk(layer: Layer): Layer {
  if (layer.type !== "text" && layer.type !== "seal") return layer;
  if (layer.tabletStyle?.color === undefined && layer.desktopStyle?.color === undefined) return layer;
  const next = { ...layer };
  if (next.tabletStyle?.color !== undefined) next.tabletStyle = stripColor(next.tabletStyle);
  if (next.desktopStyle?.color !== undefined) next.desktopStyle = stripColor(next.desktopStyle);
  return next;
}

/**
 * Splits the colours of a patch by what they ARE: a `@role` is a decision
 * about the design ("this line is the secondary ink") and belongs in the
 * shared document, where every colour of the design resolves it against its
 * own palette; a literal hex is an override for the colour on screen and
 * belongs in that variant's paint. Both halves keep the patch's nesting.
 */
function partitionColors(colors: Record<string, unknown>): {
  roles: Record<string, unknown>;
  literals: Record<string, unknown>;
} {
  const roles: Record<string, unknown> = {};
  const literals: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = partitionColors(value as Record<string, unknown>);
      if (Object.keys(nested.roles).length > 0) roles[key] = nested.roles;
      if (Object.keys(nested.literals).length > 0) literals[key] = nested.literals;
    } else if (typeof value === "string" && colorRoleOf(value) !== null) {
      // Only a COMPLETE role is a decision; "@" half-typed into the hex box
      // is not one, and travels as a literal the way any other typo does.
      roles[key] = value;
    } else {
      literals[key] = value;
    }
  }
  return { roles, literals };
}

/** Every string leaf of a nested patch, with the path that reaches it. */
function leavesOf(shape: Record<string, unknown>, prefix: string[] = []): { path: string[]; value: string }[] {
  const out: { path: string[]; value: string }[] = [];
  for (const [key, value] of Object.entries(shape)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...leavesOf(value as Record<string, unknown>, [...prefix, key]));
    } else if (typeof value === "string") {
      out.push({ path: [...prefix, key], value });
    }
  }
  return out;
}

function readAt(source: Record<string, unknown> | undefined, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** `{a: {b: value}}` for a path `["a", "b"]`. */
function shapeAt(path: string[], value: string): Record<string, unknown> {
  return path.reduceRight<Record<string, unknown>>((inner, key) => ({ [key]: inner }), value as unknown as Record<string, unknown>);
}

/**
 * Removes from `paint` every leaf that `shape` names, pruning objects left
 * empty. Returns the same object when nothing was removed, so callers can
 * tell "cleared" from "there was nothing to clear".
 */
function withoutLeaves(
  paint: Record<string, unknown>,
  shape: Record<string, unknown>,
): Record<string, unknown> {
  let out: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(shape)) {
    if (!(key in paint)) continue;
    const current = paint[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!current || typeof current !== "object" || Array.isArray(current)) continue;
      const pruned = withoutLeaves(current as Record<string, unknown>, value as Record<string, unknown>);
      if (pruned === current) continue;
      out ??= { ...paint };
      if (Object.keys(pruned).length === 0) delete out[key];
      else out[key] = pruned;
    } else {
      out ??= { ...paint };
      delete out[key];
    }
  }
  return out ?? paint;
}

/**
 * Merges a patch into a layer, recursing into nested objects.
 *
 * A plain spread would replace a whole `titleStyle` with the colour-less
 * remainder left by `splitColors`, dropping the design's own base colour and
 * failing validation on save.
 */
function mergePatch<T>(layer: T, patch: Record<string, unknown>): T {
  const out = { ...(layer as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)
        ? mergePatch(current as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return out as T;
}

export function useBuilderState(
  initial: LayoutDoc,
  initialPaint: VariantPaint = {},
  initialGeometry: VariantGeometry = {},
  initialScene?: SceneId,
) {
  const [doc, setDoc] = useState<LayoutDoc>(initial);
  /**
   * The active variant's own colours, keyed by layer id. Kept beside the
   * document rather than inside it: the document is shared by every colour of
   * the design, so a colour written into it would repaint all of them — which
   * is exactly the bug this exists to fix.
   */
  const [paint, setPaint] = useState<VariantPaint>(initialPaint);
  const [variantGeometry, setVariantGeometry] = useState<VariantGeometry>(initialGeometry);
  /** True when EITHER half of the variant's own record has unsaved edits. */
  const [paintDirty, setPaintDirty] = useState(false);
  const [transformScope, setTransformScope] = useState<TransformScope>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Scenes are user-defined now, so "cover" is a likely id rather than a
  // guaranteed one — a theme whose cover was renamed must still open.
  const [scene, setScene] = useState<SceneId>(() => initialScene ?? firstScene(initial));
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");
  const [dirty, setDirty] = useState(false);

  // History lives in state, not refs: `canUndo`/`canRedo` drive the toolbar's
  // disabled state, and a ref read during render does not re-render when it
  // changes — the buttons would go stale.
  const [past, setPast] = useState<LayoutDoc[]>([]);
  const [future, setFuture] = useState<LayoutDoc[]>([]);

  const snapshot = useCallback(() => {
    setPast((stack) => [...stack.slice(-(HISTORY_LIMIT - 1)), doc]);
    setFuture([]);
  }, [doc]);

  /** Snapshot once, then let the pointer stream write freely. */
  const beginInteraction = useCallback(() => {
    snapshot();
  }, [snapshot]);

  const mutate = useCallback(
    (updater: (draft: LayoutDoc) => LayoutDoc, options?: { history?: boolean }) => {
      if (options?.history !== false) snapshot();
      setDoc((current) => updater(current));
      setDirty(true);
    },
    [snapshot],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    // State updaters must be pure: Strict Mode may invoke them twice. The old
    // nested setters duplicated future entries and made Redo restore the
    // pre-edit document instead of the proposal the admin just undid.
    setDoc(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setFuture((forward) => [doc, ...forward.slice(0, HISTORY_LIMIT - 1)]);
    setDirty(true);
  }, [doc, past]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setDoc(future[0]);
    setPast((stack) => [...stack.slice(-(HISTORY_LIMIT - 1)), doc]);
    setFuture(future.slice(1));
    setDirty(true);
  }, [doc, future]);

  // ---- layer operations -------------------------------------------------

  const addLayer = useCallback(
    (layer: Layer) => {
      mutate((draft) => ({ ...draft, layers: [...draft.layers, layer] }));
      setSelectedId(layer.id);
    },
    [mutate],
  );

  const removeLayer = useCallback(
    (id: string) => {
      mutate((draft) => ({ ...draft, layers: draft.layers.filter((l) => l.id !== id) }));
      setSelectedId((current) => (current === id ? null : current));
    },
    [mutate],
  );

  /** Merge a colour patch into the active variant's own paint. */
  const paintLayer = useCallback((id: string, patch: Record<string, unknown>) => {
    setPaint((current) => {
      const existing = current[id] ?? {};
      const merged: Record<string, unknown> = { ...existing };
      for (const [key, value] of Object.entries(patch)) {
        const prev = merged[key];
        merged[key] =
          value && typeof value === "object" && !Array.isArray(value) && prev && typeof prev === "object"
            ? { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) }
            : value;
      }
      return { ...current, [id]: merged };
    });
    setPaintDirty(true);
  }, []);

  /**
   * The admin picked palette roles for some colours of a layer. What that
   * means depends on what this colour already says about the leaf:
   *
   * - The leaf already shows that role: nothing to do. (A block section
   *   re-sends the whole style on every edit, so this is the common case.)
   * - This colour has NO override of its own: the role is a decision about
   *   the design — "this line is the secondary ink" — and goes to the shared
   *   document, where every colour without an override follows it.
   * - This colour HAS an override: the choice is about this colour only, so
   *   the override becomes the role. Picking the role the design already
   *   holds drops the override instead — that is how a colour goes back to
   *   following the design, and it keeps the stored record minimal.
   *
   * The document half is undoable like every design edit; the paint half is
   * not, like every other colour edit — the two never move together, so an
   * undo cannot leave them contradicting each other.
   */
  const chooseRoles = useCallback(
    (id: string, roles: Record<string, unknown>) => {
      const designLayer = doc.layers.find((layer) => layer.id === id);
      if (!designLayer) return;
      const own = paint[id] ?? {};
      let nextOwn: Record<string, unknown> = own;
      const forDesign: Record<string, unknown> = {};

      for (const leaf of leavesOf(roles)) {
        const designValue = readAt(designLayer as unknown as Record<string, unknown>, leaf.path);
        const ownValue = readAt(own, leaf.path);
        const shown = ownValue ?? designValue;
        if (shown === leaf.value) continue;
        if (ownValue !== undefined) {
          nextOwn =
            leaf.value === designValue
              ? withoutLeaves(nextOwn, shapeAt(leaf.path, leaf.value))
              : mergePatch(nextOwn, shapeAt(leaf.path, leaf.value));
        } else {
          Object.assign(forDesign, mergePatch(forDesign, shapeAt(leaf.path, leaf.value)));
        }
      }

      if (nextOwn !== own) {
        setPaint((current) => {
          const next = { ...current };
          if (Object.keys(nextOwn).length === 0) delete next[id];
          else next[id] = nextOwn;
          return next;
        });
        setPaintDirty(true);
      }
      const choosesInk = typeof (roles.style as { color?: unknown } | undefined)?.color === "string";
      const liftsInk = choosesInk && liftSizedInk(designLayer) !== designLayer;
      if (Object.keys(forDesign).length > 0 || liftsInk) {
        mutate((draft) => ({
          ...draft,
          layers: draft.layers.map((layer) => {
            if (layer.id !== id) return layer;
            const next = mergePatch(layer, forDesign);
            return choosesInk ? liftSizedInk(next) : next;
          }),
        }));
      }
    },
    [doc.layers, paint, mutate],
  );

  const patchLayer = useCallback(
    (id: string, patch: Partial<Layer>, options?: { history?: boolean }) => {
      // A literal colour belongs to the variant on screen; a palette role is
      // a choice (see `chooseRoles`); everything else is the design itself.
      const { colors, rest } = splitColors(patch as Record<string, unknown>);
      const { roles, literals } = partitionColors(colors);
      if (Object.keys(literals).length > 0) paintLayer(id, literals);
      if (Object.keys(roles).length > 0) chooseRoles(id, roles);
      if (Object.keys(rest).length === 0) return;
      mutate(
        (draft) => ({
          ...draft,
          layers: draft.layers.map((l) => (l.id === id ? mergePatch(l, rest as Record<string, unknown>) : l)),
        }),
        options,
      );
    },
    [mutate, paintLayer, chooseRoles],
  );

  /**
   * Writes to `base` at the mobile breakpoint and to the matching override
   * otherwise — so tweaking desktop never silently rewrites the phone layout an
   * admin already got right.
   */
  const patchTransform = useCallback(
    (id: string, patch: TransformOverride, options?: { history?: boolean }) => {
      // This colour only: the variant's own record wins over the shared
      // document at render time, so writing here moves the layer on this
      // colour and leaves every other one exactly where it was.
      //
      // The stored shape has no breakpoint slots, so a per-colour nudge holds
      // at every screen size. That is the shape the legacy importer has always
      // written and the renderer has always read; giving it breakpoints is a
      // schema change, not a UI one.
      if (transformScope === "variant") {
        setVariantGeometry((current) => ({
          ...current,
          [id]: { ...(current[id] ?? {}), ...patch },
        }));
        setPaintDirty(true);
        return;
      }
      mutate(
        (draft) => ({
          ...draft,
          layers: draft.layers.map((layer) => {
            if (layer.id !== id) return layer;
            if (breakpoint === "base") {
              return { ...layer, base: { ...layer.base, ...patch } };
            }
            const key = breakpoint === "tablet" ? "tablet" : "desktop";
            return { ...layer, [key]: { ...(layer[key] ?? {}), ...patch } } as Layer;
          }),
        }),
        options,
      );
    },
    [mutate, breakpoint, transformScope],
  );

  const patchTextStyle = useCallback(
    (id: string, patch: TextStyleOverride) => {
      const { colors, rest } = splitColors(patch as Record<string, unknown>);
      const { roles, literals } = partitionColors(colors);
      if (Object.keys(literals).length > 0) {
        // Nested under the same key the renderer reads, so the deep merge in
        // `resolveScene` lands it on `layer.style.color`.
        paintLayer(id, { style: literals });
        // …and a per-size colour in the design would still shadow it there.
        const current = doc.layers.find((layer) => layer.id === id);
        if (typeof literals.color === "string" && current && liftSizedInk(current) !== current) {
          mutate((draft) => ({
            ...draft,
            layers: draft.layers.map((layer) => (layer.id === id ? liftSizedInk(layer) : layer)),
          }));
        }
      }
      if (typeof roles.color === "string") chooseRoles(id, { style: { color: roles.color } });
      if (Object.keys(rest).length === 0) return;
      patch = rest as TextStyleOverride;
      mutate((draft) => ({
        ...draft,
        layers: draft.layers.map((layer) => {
          if (layer.id !== id || (layer.type !== "text" && layer.type !== "seal")) return layer;
          if (breakpoint === "base") return { ...layer, style: { ...layer.style, ...patch } };
          const key = breakpoint === "tablet" ? "tabletStyle" : "desktopStyle";
          return { ...layer, [key]: { ...(layer[key] ?? {}), ...patch } };
        }),
      }));
    },
    [mutate, breakpoint, paintLayer, chooseRoles, doc.layers],
  );

  /** Drop a breakpoint's overrides so the layer inherits mobile again. */
  const clearOverrides = useCallback(
    (id: string) => {
      if (breakpoint === "base") return;
      mutate((draft) => ({
        ...draft,
        layers: draft.layers.map((layer) => {
          if (layer.id !== id) return layer;
          const next: Record<string, unknown> = { ...layer };
          // Removing the keys entirely (rather than setting them undefined) is
          // what makes the layer inherit again — the resolver merges by key.
          for (const key of breakpoint === "tablet" ? ["tablet", "tabletStyle"] : ["desktop", "desktopStyle"]) {
            delete next[key];
          }
          return next as unknown as Layer;
        }),
      }));
    },
    [mutate, breakpoint],
  );

  /** Move a layer up or down the paint order within its own scene. */
  const moveLayer = useCallback(
    (id: string, direction: -1 | 1) => {
      mutate((draft) => {
        const target = draft.layers.find((l) => l.id === id);
        if (!target) return draft;
        const siblings = draft.layers
          .filter((l) => l.scene === target.scene)
          .sort((a, b) => a.z - b.z);
        const index = siblings.findIndex((l) => l.id === id);
        const swapWith = siblings[index + direction];
        if (!swapWith) return draft;
        return {
          ...draft,
          layers: draft.layers.map((l) => {
            if (l.id === target.id) return { ...l, z: swapWith.z };
            if (l.id === swapWith.id) return { ...l, z: target.z };
            return l;
          }),
        };
      });
    },
    [mutate],
  );

  // ---- scene operations -------------------------------------------------

  /** The scene's stage geometry — aspect ratio and safe inset. */
  const patchScene = useCallback(
    (id: SceneId, patch: Partial<SceneCanvas>) => {
      mutate((draft) => ({
        ...draft,
        scenes: draft.scenes.map((entry) =>
          entry.id === id ? { ...entry, canvas: { ...entry.canvas, ...patch } } : entry,
        ),
      }));
    },
    [mutate],
  );

  /**
   * Name / role / visibility / requirement.
   *
   * Two invariants the guest flow depends on are enforced here rather than
   * only in the panel, because a document that reaches the database without
   * them renders an invitation nobody can open:
   *
   * - **Exactly one `cover`.** Promoting a scene demotes the previous cover to
   *   `flow`; demoting the last remaining cover is dropped from the patch.
   * - **At most one `pass`, and one `passNoQr`.** Same demotion, without the
   *   "at least one" half — a theme with no entry pass is a legitimate design.
   *
   * The cover is also pinned visible: hiding it would leave the guest with no
   * screen to tap, which reads as a broken invitation rather than a hidden one.
   */
  const patchSceneDef = useCallback(
    (id: SceneId, patch: SceneDefPatch) => {
      mutate((draft) => {
        const target = draft.scenes.find((entry) => entry.id === id);
        if (!target) return draft;

        const next: SceneDefPatch = { ...patch };
        if (next.role !== undefined && next.role !== target.role) {
          const isLastCover =
            target.role === "cover" && draft.scenes.filter((s) => s.role === "cover").length <= 1;
          if (isLastCover) delete next.role;
        }
        const promotedTo = next.role;
        if ((promotedTo ?? target.role) === "cover" && next.visible === false) delete next.visible;

        return {
          ...draft,
          scenes: draft.scenes.map((entry) => {
            if (entry.id === id) return { ...entry, ...next };
            // Demote whichever scene held the singleton role being claimed.
            if (
              (promotedTo === "cover" || promotedTo === "pass" || promotedTo === "passNoQr") &&
              entry.role === promotedTo
            ) {
              return { ...entry, role: "flow" as const };
            }
            return entry;
          }),
        };
      });
    },
    [mutate],
  );

  /**
   * Append a scene. It lands before the entry pass when one exists — the pass
   * (either of them) is the end of the guest's journey, so a new screen almost
   * always belongs ahead of it rather than after.
   */
  const addScene = useCallback(
    () => {
      const id = uniqueSceneId(doc);
      mutate((draft) => {
        if (draft.scenes.length >= MAX_SCENES) return draft;
        const scenes = [...draft.scenes];
        const entry: SceneDef = {
          id,
          name: `شاشة ${arabicNumber(scenes.length + 1)}`,
          role: "flow",
          canvas: { ...DEFAULT_CANVAS },
          visible: true,
          requires: null,
        };
        const passIndex = scenes.findIndex((s) => s.role === "pass" || s.role === "passNoQr");
        if (passIndex === -1) scenes.push(entry);
        else scenes.splice(passIndex, 0, entry);
        return { ...draft, scenes };
      });
      if (doc.scenes.length < MAX_SCENES) {
        setScene(id);
        setSelectedId(null);
      }
      return id;
    },
    [doc, mutate],
  );

  /**
   * Delete a scene **and its layers** — a layer pointing at a scene that no
   * longer exists is invisible everywhere and impossible to select, so leaving
   * them behind would only grow an unreachable pile.
   *
   * Refused for the last remaining scene and for the cover, which has to exist.
   */
  const removeScene = useCallback(
    (id: SceneId) => {
      const target = doc.scenes.find((entry) => entry.id === id);
      if (!target || target.role === "cover" || doc.scenes.length <= 1) return;

      mutate((draft) => ({
        ...draft,
        scenes: draft.scenes.filter((entry) => entry.id !== id),
        layers: draft.layers.filter((layer) => layer.scene !== id),
      }));
      setSelectedId((current) =>
        current && doc.layers.some((l) => l.id === current && l.scene === id) ? null : current,
      );
      // The active scene is derived below, so it falls back on its own once
      // this one is gone — including when an undo brings it back.
    },
    [doc, mutate],
  );

  /**
   * Reorder a scene — this is the order the guest scrolls through.
   *
   * Only two flow scenes ever swap. The cover opens the invitation and the
   * pass closes it, so neither moves and nothing moves past them; the panel
   * disables the arrows that would try, and this refuses them anyway so no
   * other caller can push the cover into the middle of the list.
   */
  const moveScene = useCallback(
    (id: SceneId, direction: -1 | 1) => {
      mutate((draft) => {
        const index = draft.scenes.findIndex((entry) => entry.id === id);
        if (index === -1 || draft.scenes[index].role !== "flow") return draft;
        const swapWith = index + direction;
        if (swapWith < 0 || swapWith >= draft.scenes.length) return draft;
        if (draft.scenes[swapWith].role !== "flow") return draft;
        const scenes = [...draft.scenes];
        [scenes[index], scenes[swapWith]] = [scenes[swapWith], scenes[index]];
        return { ...draft, scenes };
      });
    },
    [mutate],
  );

  /** How many layers a scene would take with it. Shown before a delete. */
  const sceneLayerCount = useCallback(
    (id: SceneId) => doc.layers.filter((layer) => layer.scene === id).length,
    [doc.layers],
  );

  const patchAnimation = useCallback(
    (patch: Partial<AnimationSettings>) => {
      mutate((draft) => ({ ...draft, animation: { ...draft.animation, ...patch } }));
    },
    [mutate],
  );

  /**
   * The full-page backdrop. Document-level like the animation settings, not
   * per-scene and not a layer — it sits behind every scene at once.
   */
  const patchPage = useCallback(
    (patch: Partial<PageBackground>) => {
      mutate((draft) => ({ ...draft, page: { ...draft.page, ...patch } }));
    },
    [mutate],
  );

  /** Next free z within a scene, so a new layer lands on top. */
  const nextZ = useCallback(
    (target: SceneId) => {
      const zs = doc.layers.filter((l) => l.scene === target).map((l) => l.z);
      return zs.length === 0 ? 0 : Math.max(...zs) + 1;
    },
    [doc.layers],
  );

  /**
   * The layers as the ACTIVE VARIANT renders them: the shared design with this
   * variant's own colours merged in. The canvas and the inspector both read
   * this, so the swatch in the panel always matches the pixels on the stage.
   */
  const paintedLayers = useMemo(
    () => doc.layers.map((layer) => (paint[layer.id] ? applyPaint(layer, paint[layer.id]) : layer)),
    [doc.layers, paint],
  );

  const selected = useMemo(
    () => paintedLayers.find((l) => l.id === selectedId) ?? null,
    [paintedLayers, selectedId],
  );

  /**
   * The scene actually being edited.
   *
   * Derived rather than stored, because the stored id can outlive the scene:
   * undoing a scene creation, deleting the open scene, or adopting the
   * document a server action just wrote all leave the raw id dangling. Falling
   * back here fixes every one of those in the same place.
   */
  const activeScene = useMemo(
    () => (doc.scenes.some((entry) => entry.id === scene) ? scene : firstScene(doc)),
    [doc, scene],
  );

  const markSaved = useCallback((saved: LayoutDoc) => {
    setDoc(saved);
    setDirty(false);
  }, []);

  /** Load another variant's colours — called when the admin switches colour. */
  /**
   * The variant's record in the shape the renderer reads: geometry at the top
   * level, colours nested under `paint`. Built here so the canvas previews
   * exactly what a guest would see on this colour.
   */
  const variantOverrides = useMemo(() => {
    const out: Record<string, Record<string, unknown>> = {};
    for (const id of new Set([...Object.keys(variantGeometry), ...Object.keys(paint)])) {
      const geometry = variantGeometry[id] ?? {};
      const colours = paint[id];
      out[id] = colours && Object.keys(colours).length > 0 ? { ...geometry, paint: colours } : { ...geometry };
    }
    return out;
  }, [variantGeometry, paint]);

  const replacePaint = useCallback((next: VariantPaint) => {
    setPaint(next);
    setPaintDirty(false);
  }, []);

  return {
    doc,
    setDoc,
    // Explicit presets are one normal, undoable shared-document edit.
    applyDocument: (next: LayoutDoc) => mutate(() => next),
    dirty,
    markSaved,
    paint,
    variantGeometry,
    variantOverrides,
    paintedLayers,
    paintDirty,
    transformScope,
    setTransformScope,
    replacePaint,
    replaceVariantGeometry: setVariantGeometry,
    markPaintSaved: useCallback(() => setPaintDirty(false), []),
    scene: activeScene,
    setScene,
    breakpoint,
    setBreakpoint,
    selectedId,
    setSelectedId,
    selected,
    addLayer,
    removeLayer,
    patchLayer,
    patchTransform,
    patchTextStyle,
    clearOverrides,
    moveLayer,
    patchScene,
    patchSceneDef,
    addScene,
    removeScene,
    moveScene,
    sceneLayerCount,
    patchAnimation,
    patchPage,
    beginInteraction,
    nextZ,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

export const BASE_TRANSFORM: Transform = DEFAULT_TRANSFORM;
