"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_TRANSFORM,
  type Breakpoint,
  type Layer,
  type LayoutDoc,
  type PageBackground,
  type SceneCanvas,
  type SceneId,
  type TextStyleOverride,
  type Transform,
  type TransformOverride,
  type AnimationSettings,
} from "@/lib/themes/builder/types";

const HISTORY_LIMIT = 60;

/**
 * Editor state for one layout document.
 *
 * Two update paths on purpose. Dragging calls `patchTransform` many times per
 * second and must not fill the undo stack with a hundred intermediate frames,
 * so the interaction snapshots once at pointer-down (`beginInteraction`) and
 * writes live afterwards. Everything else — a numeric field, a toggle, adding a
 * layer — snapshots per change, which is what makes undo feel right.
 */
export function useBuilderState(initial: LayoutDoc) {
  const [doc, setDoc] = useState<LayoutDoc>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneId>("cover");
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
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setDoc((current) => {
        setFuture((forward) => [current, ...forward.slice(0, HISTORY_LIMIT - 1)]);
        return previous;
      });
      setDirty(true);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((forward) => {
      if (forward.length === 0) return forward;
      const next = forward[0];
      setDoc((current) => {
        setPast((stack) => [...stack, current]);
        return next;
      });
      setDirty(true);
      return forward.slice(1);
    });
  }, []);

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

  const patchLayer = useCallback(
    (id: string, patch: Partial<Layer>, options?: { history?: boolean }) => {
      mutate(
        (draft) => ({
          ...draft,
          layers: draft.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
        }),
        options,
      );
    },
    [mutate],
  );

  /**
   * Writes to `base` at the mobile breakpoint and to the matching override
   * otherwise — so tweaking desktop never silently rewrites the phone layout an
   * admin already got right.
   */
  const patchTransform = useCallback(
    (id: string, patch: TransformOverride, options?: { history?: boolean }) => {
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
    [mutate, breakpoint],
  );

  const patchTextStyle = useCallback(
    (id: string, patch: TextStyleOverride) => {
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
    [mutate, breakpoint],
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

  const patchScene = useCallback(
    (id: SceneId, patch: Partial<SceneCanvas>) => {
      mutate((draft) => ({ ...draft, scenes: { ...draft.scenes, [id]: { ...draft.scenes[id], ...patch } } }));
    },
    [mutate],
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

  const selected = useMemo(
    () => doc.layers.find((l) => l.id === selectedId) ?? null,
    [doc.layers, selectedId],
  );

  const markSaved = useCallback((saved: LayoutDoc) => {
    setDoc(saved);
    setDirty(false);
  }, []);

  return {
    doc,
    setDoc,
    dirty,
    markSaved,
    scene,
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
