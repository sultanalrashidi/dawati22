import { notFound } from "next/navigation";
import QRCode from "qrcode";
import snapshot from "@/data/public-theme-catalog.snapshot.json";
import { RibbonPassReview } from "@/components/themes/ribbon-pass-review";
import { assertLayoutDoc, assertTypographyDoc, parseLayoutDoc } from "@/lib/themes/builder/schema";
import { proposeRibbonFlow } from "@/lib/themes/builder/ribbon-flow";
import { proposeRibbonPass } from "@/lib/themes/builder/ribbon-pass";
import { RIBBON_THEME_SLUG } from "@/lib/themes/builder/ribbon-greeting";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

/** Public snapshot, no admin session or database. Never exposed in production. */
export default async function RibbonPassReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const family = snapshot.filter((entry) => entry.config.family === RIBBON_THEME_SLUG);
  function document(raw: unknown, field: "layout" | "typography", depth = 0): unknown {
    if (typeof raw !== "string") return raw;
    const match = /:themes:(\d+):builder:(layout|typography)$/.exec(raw);
    if (!match || match[2] !== field || depth > snapshot.length) notFound();
    return document(snapshot[Number(match[1])]?.builder[field], field, depth + 1);
  }
  const raw = parseLayoutDoc(assertLayoutDoc(document(family[0].builder.layout, "layout")));
  const overrides = family.map((entry) => entry.builder.overrides as LayoutOverrides);
  const approved = proposeRibbonFlow(RIBBON_THEME_SLUG, raw, overrides);
  if (!approved.ok) throw new Error(approved.reason);
  const proposal = proposeRibbonPass(RIBBON_THEME_SLUG, approved.layout, overrides);
  if (!proposal.ok) throw new Error(proposal.reason);
  // Same encoder settings as real passes, but a non-entry test payload.
  const qrDataUrl = await QRCode.toDataURL("dawati-preview-not-an-entry-pass", { errorCorrectionLevel: "M", margin: 1, width: 320 });
  const colorNames: Record<string, string> = { "وردي": "وردي", "أزرق": "أزرق بودري", "بني": "موكا شامبين", "موف": "موف ترابي" };
  return <RibbonPassReview original={approved.layout} proposed={proposal.layout} qrDataUrl={qrDataUrl}
    typography={assertTypographyDoc(document(family[0].builder.typography, "typography"))}
    variants={family.map((entry) => ({ slug: entry.slug, name: colorNames[entry.config.colorTag ?? ""] ?? "سيج لؤلؤي",
      palette: entry.builder.palette, assets: entry.builder.assets as Record<string, string>, overrides: entry.builder.overrides as LayoutOverrides }))} />;
}
