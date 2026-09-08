import { notFound } from "next/navigation";
import snapshot from "@/data/public-theme-catalog.snapshot.json";
import { RibbonFlowReview } from "@/components/themes/ribbon-flow-review";
import { assertLayoutDoc, assertTypographyDoc, parseLayoutDoc } from "@/lib/themes/builder/schema";
import { proposeRibbonFlow } from "@/lib/themes/builder/ribbon-flow";
import { RIBBON_THEME_SLUG } from "@/lib/themes/builder/ribbon-greeting";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

/** Public sample fixture only: no live admin session, database or saved RSVP. */
export default async function RibbonFlowReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const family = snapshot.filter((entry) => entry.config.family === RIBBON_THEME_SLUG);
  function document(raw: unknown, field: "layout" | "typography", depth = 0): unknown {
    if (typeof raw !== "string") return raw;
    const match = /:themes:(\d+):builder:(layout|typography)$/.exec(raw);
    if (!match || match[2] !== field || depth > snapshot.length) notFound();
    return document(snapshot[Number(match[1])]?.builder[field], field, depth + 1);
  }
  const original = parseLayoutDoc(assertLayoutDoc(document(family[0].builder.layout, "layout")));
  const proposal = proposeRibbonFlow(RIBBON_THEME_SLUG, original, family.map((entry) => entry.builder.overrides as LayoutOverrides));
  if (!proposal.ok) throw new Error(proposal.reason);
  const colorNames: Record<string, string> = { "وردي": "وردي", "أزرق": "أزرق بودري", "بني": "موكا شامبين", "موف": "موف ترابي" };
  return <RibbonFlowReview original={original} proposed={proposal.layout}
    typography={assertTypographyDoc(document(family[0].builder.typography, "typography"))}
    variants={family.map((entry) => ({ slug: entry.slug, name: colorNames[entry.config.colorTag ?? ""] ?? "سيج لؤلؤي",
      palette: entry.builder.palette, assets: entry.builder.assets as Record<string, string>,
      overrides: entry.builder.overrides as LayoutOverrides }))} />;
}
