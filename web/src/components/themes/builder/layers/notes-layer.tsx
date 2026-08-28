import type { NotesLayer, TypographyDoc } from "@/lib/themes/builder/types";
import { justifyFor, scaled, textStyleToCss } from "./style";

/**
 * The organiser's notes for guests — dress code, parking, children — one per
 * line of the event's `notesAr`, each carrying the layer's bullet character.
 */

/** Shown while designing, when no event is attached to the stage yet. */
const SAMPLE_NOTES = ["الحضور في الموعد المحدد", "يرجى إحضار بطاقة الدخول"];

export function NotesContent({
  layer,
  typography,
  notesAr,
}: {
  layer: NotesLayer;
  typography: TypographyDoc;
  /**
   * The organiser's raw notes, one per line. `undefined` means no event is
   * attached — the editor — and the sample lines stand in; `null` or an empty
   * string means this organiser wrote none, and the block prints only its title.
   */
  notesAr?: string | null;
}) {
  const items =
    notesAr === undefined
      ? SAMPLE_NOTES
      : (notesAr ?? "")
          .split("\n")
          .map((note) => note.trim())
          .filter(Boolean);

  const titleCss = textStyleToCss(layer.titleStyle, typography);
  const itemCss = textStyleToCss(layer.itemStyle, typography);
  const bullet = layer.bullet.trim();

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col"
      style={{ gap: scaled(6), justifyContent: justifyFor(layer.titleStyle.align) }}
    >
      {layer.title && <div style={titleCss}>{layer.title}</div>}
      {items.map((note, index) => (
        <div key={index} className="flex w-full items-baseline" style={{ ...itemCss, gap: scaled(6) }}>
          {bullet && (
            <span aria-hidden="true" className="shrink-0">
              {bullet}
            </span>
          )}
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{note}</span>
        </div>
      ))}
    </div>
  );
}
