"use client";

import { GhostButton, Panel } from "@/components/admin/builder/builder-ui";
import { slotLabelAr } from "@/lib/themes/builder/slots";
import { layersForScene, type Layer, type LayoutDoc, type SceneId } from "@/lib/themes/builder/types";

const TYPE_ICON: Record<Layer["type"], string> = {
  asset: "🖼",
  text: "T",
  seal: "◈",
  qr: "▦",
};

export function LayersPanel({
  doc,
  scene,
  selectedId,
  onSelect,
  onMove,
  onPatch,
  onRemove,
}: {
  doc: LayoutDoc;
  scene: SceneId;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onPatch: (id: string, patch: Partial<Layer>) => void;
  onRemove: (id: string) => void;
}) {
  // Top of the list is the top of the stack, which is how every design tool
  // shows it — so the visual order is reversed from paint order.
  const layers = [...layersForScene(doc, scene)].reverse();

  return (
    <Panel title="الطبقات">
      {layers.length === 0 ? (
        <p className="text-xs text-fg-muted">ما فيه طبقات في هذا المشهد. أضف عنصرًا من الشريط العلوي.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {layers.map((layer, index) => (
            <li
              key={layer.id}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                layer.id === selectedId ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface-2"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(layer.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
              >
                <span className="w-4 shrink-0 text-center text-xs text-fg-muted">{TYPE_ICON[layer.type]}</span>
                <span className={`truncate text-xs ${layer.visible ? "text-fg" : "text-fg-muted line-through"}`}>
                  {layer.name || (layer.type === "asset" ? slotLabelAr(layer.slot) : layer.type)}
                </span>
              </button>

              <GhostButton
                title={layer.visible ? "إخفاء" : "إظهار"}
                onClick={() => onPatch(layer.id, { visible: !layer.visible })}
              >
                {layer.visible ? "👁" : "🚫"}
              </GhostButton>
              <GhostButton
                title={layer.locked ? "فك القفل" : "قفل"}
                onClick={() => onPatch(layer.id, { locked: !layer.locked })}
              >
                {layer.locked ? "🔒" : "🔓"}
              </GhostButton>
              <GhostButton title="للأعلى" disabled={index === 0} onClick={() => onMove(layer.id, 1)}>
                ↑
              </GhostButton>
              <GhostButton title="للأسفل" disabled={index === layers.length - 1} onClick={() => onMove(layer.id, -1)}>
                ↓
              </GhostButton>
              <GhostButton title="حذف" danger onClick={() => onRemove(layer.id)}>
                ✕
              </GhostButton>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
