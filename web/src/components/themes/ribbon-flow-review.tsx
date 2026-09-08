"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeStage } from "./builder/theme-stage";
import { resolveContent, SAMPLE_CONTENT_INPUT } from "@/lib/themes/builder/content";
import { RIBBON_FLOW_SCENES } from "@/lib/themes/builder/ribbon-flow";
import type { LayoutDoc, TypographyDoc, VariantPalette } from "@/lib/themes/builder/types";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";
import type { RsvpResponse } from "./builder/layers/rsvp-layer";

type Variant = { slug: string; name: string; palette: VariantPalette; assets: Record<string, string>; overrides: LayoutOverrides };
const TITLES = ["العد التنازلي", "كل ما يهمكم", "برنامج اليوم", "الملاحظات", "تأكيد الحضور"];
const NORMAL_SCHEDULE = [
  { time: "٨:٠٠ م", labelAr: "استقبال الضيوف" },
  { time: "٩:٣٠ م", labelAr: "الزفة" },
  { time: "١٠:٣٠ م", labelAr: "العشاء" },
];
const LONG_SCHEDULE = Array.from({ length: 8 }, (_, i) => ({ time: `${i + 3}:٣٠ م`, labelAr: i % 2 ? "التصوير التذكاري مع الأهل والأصدقاء" : "استقبال الضيوف والترحيب بهم في القاعة الرئيسية" }));
const NORMAL_NOTES = "يرجى إبراز بطاقة الدخول عند الوصول\nنعتذر عن استقبال الأطفال\nيرجى عدم التصوير احترامًا للخصوصية";
const LONG_NOTES = Array.from({ length: 8 }, (_, i) => `${i + 1}. نرجو من ضيوفنا الكرام الالتزام بالموعد المحدد وإبراز بطاقة الدخول الخاصة عند البوابة الرئيسية للقاعة.`).join("\n");

export function RibbonFlowReview({ original, proposed, typography, variants }: {
  original: LayoutDoc; proposed: LayoutDoc; typography: TypographyDoc; variants: Variant[];
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [before, setBefore] = useState(false);
  const [long, setLong] = useState(false);
  const [small, setSmall] = useState(false);
  const [answered, setAnswered] = useState<RsvpResponse | null>(null);
  const [action, setAction] = useState("");
  const variant = variants[variantIndex];
  const layout = before ? original : proposed;
  const scene = RIBBON_FLOW_SCENES[sceneIndex];
  const width = small ? 320 : 390;
  const height = small ? 650 : 780;
  const eventDate = long ? "2029-12-31T18:00:00.000Z" : "2026-11-20T18:00:00.000Z";
  const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, eventDate,
    guestName: long ? "الجوهرة بنت عبدالرحمن عبدالعزيز" : "أم فهد",
    locationName: long ? "قاعة الاحتفالات الكبرى في فندق الرياض — المدخل الشرقي" : "قاعة الماسة",
    regionName: "الرياض",
  });
  function resetPreview() { setAnswered(null); setAction(""); }
  const control = "rounded-full border border-current/20 px-4 py-2 text-sm transition-colors aria-pressed:bg-fg aria-pressed:text-bg focus-visible:outline-2 focus-visible:outline-offset-4";
  return <main dir="rtl" className="min-h-screen bg-surface py-7 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 space-y-3 px-3 sm:px-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div><p className="mb-2 text-xs text-fg-muted">معاينة محلية · نفس الصور والألوان · بيانات توضيحية</p>
            <h1 className="text-2xl font-semibold">فيونكة الورد <span className="font-normal text-fg-muted">/ الصفحات الداخلية</span></h1></div>
          <Link href="/ar/themes/ribbon-review?flow=1" className="text-sm underline underline-offset-4">افتح التنسيق في المحرر المحلي</Link>
        </div>
        <nav aria-label="صفحات الدعوة" className="flex flex-wrap gap-2">
          {TITLES.map((title, index) => <button key={title} type="button" className={control} aria-pressed={sceneIndex === index}
            onClick={() => { setSceneIndex(index); resetPreview(); }}>{title}</button>)}
        </nav>
      </header>
      <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0">
          <div data-ribbon-screen data-scene={scene} data-before={before} className="relative mx-auto isolate overflow-hidden rounded-[22px] border border-black/10 shadow-lg"
            style={{ width: `min(100%, ${width}px)`, aspectRatio: `${width}/${height}`, background: variant.palette.bg, color: variant.palette.fg }}>
            {/* Same asset, fit and optional tint as the guest's full-page backdrop, confined to this review frame. */}
            {layout.page.slot && variant.assets[layout.page.slot] &&
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={variant.assets[layout.page.slot]} alt="" className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ objectFit: layout.page.fit }} />}
            {layout.page.overlayOpacity > 0 && <div className="pointer-events-none absolute inset-0" style={{ background: layout.page.overlayColor, opacity: layout.page.overlayOpacity }} />}
            <div className="absolute inset-0 flex items-center justify-center px-6 py-20"
              onClickCapture={(event) => { const link = (event.target as HTMLElement).closest("a"); if (link) { event.preventDefault(); setAction(`معاينة فقط: ${link.textContent}`); } }}>
              <div className="w-full" style={{ maxWidth: Math.min(416, (height - 160) * 390 / 620) }}>
                <ThemeStage key={`${scene}-${variant.slug}-${before}-${long}-${small}`} layout={layout} typography={typography} palette={variant.palette}
                  assets={variant.assets} overrides={variant.overrides} content={content} scene={scene} breakpoint="base"
                  eventDateIso={eventDate} scheduleItems={long ? LONG_SCHEDULE : NORMAL_SCHEDULE} notesAr={long ? LONG_NOTES : NORMAL_NOTES}
                  linkToken="local-preview-only" mapUrl="https://maps.google.com/?q=24.7136,46.6753"
                  rsvp={{ guestName: content.guestName, allowedCount: 4, allowGuestPartySize: true, simulate: true, onResponded: (response) => setAnswered(response) }}
                  style={{ backgroundColor: "transparent" }} />
              </div>
            </div>
          </div>
          <p role="status" className="mx-auto mt-4 max-w-[390px] text-center text-sm text-fg-muted">
            {answered ? "تمت محاكاة الرد محليًا فقط، ولم يُرسل إلى الموقع." : action || "يمكنك تجربة الأزرار والنموذج هنا دون إرسال أي بيانات."}
          </p>
        </div>
        <aside className="mx-3 space-y-6 rounded-2xl border border-border bg-bg p-5 sm:mx-0">
          <fieldset><legend className="mb-3 text-sm font-semibold">لون التصميم</legend>
            <div className="flex flex-col gap-2">{variants.map((item, index) => <button key={item.slug} type="button" aria-pressed={variantIndex === index}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-start text-sm aria-pressed:border-current/25 aria-pressed:bg-surface focus-visible:outline-2"
              onClick={() => { setVariantIndex(index); resetPreview(); }}>
              <span aria-hidden className="h-4 w-4 rounded-full border border-black/10" style={{ background: item.palette.swatch }} />{item.name}
            </button>)}</div>
          </fieldset>
          <fieldset><legend className="mb-3 text-sm font-semibold">قارن التنسيق</legend><div className="flex gap-2">
            <button type="button" className={control} aria-pressed={!before} onClick={() => { setBefore(false); resetPreview(); }}>بعد</button>
            <button type="button" className={control} aria-pressed={before} onClick={() => { setBefore(true); resetPreview(); }}>قبل</button>
          </div></fieldset>
          <div className="flex flex-col gap-2">
            <button type="button" className={control} aria-pressed={small} onClick={() => { setSmall(!small); resetPreview(); }}>جوال صغير 320</button>
            <button type="button" className={control} aria-pressed={long} onClick={() => { setLong(!long); resetPreview(); }}>نصوص وقوائم طويلة</button>
          </div>
          <p className="text-xs leading-6 text-fg-muted">أميري للعناوين، وبلكس للتفاصيل والحقول. هذه المعاينة لا تغيّر التصميم المنشور.</p>
        </aside>
      </div>
    </div>
  </main>;
}
