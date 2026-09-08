import { notFound } from "next/navigation";
import Link from "next/link";
import snapshot from "@/data/public-theme-catalog.snapshot.json";
import { ThemeBuilder } from "@/components/admin/builder/theme-builder";
import { BUILTIN_FONTS } from "@/lib/themes/font-registry";
import { SAMPLE_CONTENT_INPUT } from "@/lib/themes/builder/content";
import { assertLayoutDoc, assertTypographyDoc, parseLayoutDoc } from "@/lib/themes/builder/schema";
import { proposeRibbonGreeting, RIBBON_THEME_SLUG } from "@/lib/themes/builder/ribbon-greeting";
import { proposeRibbonFlow } from "@/lib/themes/builder/ribbon-flow";
import { proposeRibbonPass } from "@/lib/themes/builder/ribbon-pass";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

/** The real editor, fed only public sample documents. No auth/DB loader. */
export default async function RibbonReview({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const family = snapshot.filter((entry) => entry.config.family === RIBBON_THEME_SLUG);
  function document(raw: unknown, field: "layout" | "typography", depth = 0): unknown {
    if (typeof raw !== "string") return raw;
    const match = /:themes:(\d+):builder:(layout|typography)$/.exec(raw);
    if (!match || match[2] !== field || depth > snapshot.length) notFound();
    return document(snapshot[Number(match[1])]?.builder[field], field, depth + 1);
  }
  const original = parseLayoutDoc(assertLayoutDoc(document(family[0].builder.layout, "layout")));
  const flow = params.flow === "1";
  const pass = params.pass === "1";
  const overrides = family.map((entry) => entry.builder.overrides as LayoutOverrides);
  // Only the pass fixture starts from the five locally approved flow screens.
  // Its "before" is therefore before the pass edit, not before those approvals.
  let baseline = original;
  if (pass) {
    const approvedFlow = proposeRibbonFlow(RIBBON_THEME_SLUG, original, overrides);
    if (!approvedFlow.ok) throw new Error(approvedFlow.reason);
    baseline = approvedFlow.layout;
  }
  const propose = pass ? proposeRibbonPass : flow ? proposeRibbonFlow : proposeRibbonGreeting;
  const proposal = propose(RIBBON_THEME_SLUG, baseline, overrides);
  if (!proposal.ok) throw new Error(proposal.reason);
  const width = params.width === "320" ? 320 : 390;
  const long = params.long === "1";
  const before = params.before === "1";
  const content = { ...SAMPLE_CONTENT_INPUT, eventDate: "2026-11-20T18:00:00.000Z", couples: [{
    ...SAMPLE_CONTENT_INPUT.couples[0],
    groomNameAr: long ? "عبدالرحمن عبدالعزيز" : "فيصل",
    brideNameAr: long ? "الجوهرة عبدالله" : "نورة",
    groomFamilyAr: null, brideFamilyAr: null,
  }] };
  const variants = family.map((entry, index) => ({
    id: `preview-ribbon-${index}`, slug: entry.slug, name: entry.name,
    nameAr: entry.config.colorTag ?? "أخضر", colorTag: entry.config.colorTag ?? "أخضر",
    palette: entry.builder.palette, overrides: entry.builder.overrides as LayoutOverrides,
    isDefault: entry.slug === (typeof params.variant === "string" ? params.variant : RIBBON_THEME_SLUG),
  }));
  const assets = family.flatMap((entry, index) => Object.entries(entry.builder.assets).map(([slot, url]) => ({
    id: `preview-asset-${index}-${slot}`, slot, url: url as string, variantId: variants[index].id,
    width: null, height: null, fileSize: null,
  })));
  const query = `width=${width}${long ? "&long=1" : ""}${before ? "&before=1" : ""}${flow ? "&flow=1" : ""}${pass ? "&pass=1" : ""}`;
  return <main dir="rtl" className="mx-auto max-w-7xl px-3 py-8">
    <header className="mb-5 flex flex-wrap items-center gap-3">
      <h1 className="text-xl font-semibold">فيونكة الورد · {pass ? "مراجعة بطاقة الدخول" : flow ? "مراجعة الصفحات الخمس" : "مراجعة شاشة الترحيب"}</h1>
      <Link className="rounded-full border px-4 py-2 text-sm" href={`?${query.replace(`width=${width}`, `width=${width === 320 ? 390 : 320}`)}`}>عرض {width === 320 ? "390" : "320"}</Link>
      <Link className="rounded-full border px-4 py-2 text-sm" href={`?${query.replace("&long=1", "")}${long ? "" : "&long=1"}`}>{long ? "أسماء قصيرة" : "أسماء طويلة"}</Link>
      <Link className="rounded-full border px-4 py-2 text-sm" href={`?${query.replace("&before=1", "")}${before ? "" : "&before=1"}`}>{before ? "التنسيق المقترح" : "قبل التنسيق"}</Link>
    </header>
    {pass && <p className="mb-4 text-sm text-fg-muted">
      {before ? "بطاقة الدخول قبل التنسيق الجديد" : "بطاقة الدخول بالتنسيق المقترح"} · الصفحات الخمس المعتمدة محليًا في 8 سبتمبر 2026 محفوظة في الحالتين. هذه عينة محلية وليست قراءة من الأدمن أو نشرًا على الموقع.
    </p>}
    <ThemeBuilder key={query} themeId="preview-ribbon-only" themeSlug={RIBBON_THEME_SLUG}
      themeStatus="DRAFT" locale="ar" initialLayout={before ? baseline : proposal.layout}
      // Preview-only: this editor never reaches saveLayoutAction, so there is
      // no live ThemeLayout revision to guard against.
      layoutRevision={null}
      typography={assertTypographyDoc(document(family[0].builder.typography, "typography"))}
      variants={variants} assets={assets} fonts={BUILTIN_FONTS} blobEnabled={false}
      localPreview={{ width, height: width === 320 ? 650 : 780, content, initialScene: pass ? "pass" : flow ? "countdown" : "greeting" }} />
  </main>;
}
