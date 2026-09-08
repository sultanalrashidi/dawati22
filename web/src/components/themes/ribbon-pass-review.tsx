"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeStage } from "./builder/theme-stage";
import { resolveContent, SAMPLE_CONTENT_INPUT } from "@/lib/themes/builder/content";
import type { LayoutDoc, TypographyDoc, VariantPalette } from "@/lib/themes/builder/types";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

type Variant = { slug: string; name: string; palette: VariantPalette; assets: Record<string, string>; overrides: LayoutOverrides };

/** Local sample only. The QR encodes a non-entry test value, never a guest token. */
export function RibbonPassReview({ original, proposed, typography, variants, qrDataUrl }: {
  original: LayoutDoc; proposed: LayoutDoc; typography: TypographyDoc; variants: Variant[]; qrDataUrl: string;
}) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [before, setBefore] = useState(false);
  const [small, setSmall] = useState(false);
  const [long, setLong] = useState(false);
  const [coupleCount, setCoupleCount] = useState(1);
  const [noQr, setNoQr] = useState(false);
  const [extra, setExtra] = useState(false);
  const variant = variants[variantIndex];
  const layout = before ? original : proposed;
  const width = small ? 320 : 390;
  const height = small ? 650 : 780;
  const names = [["فيصل", "نورة"], ["عبدالله", "سارة"], ["فهد", "ريم"], ["سعود", "الجوهرة"]];
  const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, allowedCount: 2,
    guestName: long ? "الجوهرة بنت عبدالرحمن عبدالعزيز" : "أم فهد",
    couples: names.slice(0, coupleCount).map(([groom, bride]) => ({ ...SAMPLE_CONTENT_INPUT.couples[0],
      groomNameAr: long ? `${groom} عبدالرحمن` : groom, brideNameAr: long ? `${bride} عبدالله` : bride })),
    invitationTextAr: extra ? "بحضوركم تكتمل فرحتنا، ويسعدنا أن تشاركونا أجمل لحظات العمر" : "",
    eventDate: "2026-11-20T18:00:00.000Z",
    locationName: long ? "قاعة الاحتفالات الكبرى في فندق الرياض — المدخل الشرقي" : "قاعة الماسة", regionName: "الرياض",
  });
  const control = "rounded-full border border-current/20 px-4 py-2 text-sm aria-pressed:bg-fg aria-pressed:text-bg focus-visible:outline-2 focus-visible:outline-offset-4";
  return <main dir="rtl" className="min-h-screen bg-surface py-7 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 space-y-3 px-3 sm:px-0">
        <p className="text-xs text-fg-muted">معاينة محلية · نفس الصور والألوان · بيانات توضيحية</p>
        <h1 className="text-2xl font-semibold">فيونكة الورد <span className="font-normal text-fg-muted">/ بطاقة الدخول</span></h1>
        <nav className="flex flex-wrap gap-5 text-sm">
          <Link href="/ar/themes/ribbon-flow-review" className="underline underline-offset-4">الصفحات الخمس المعتمدة</Link>
          <Link href="/ar/themes/ribbon-review?pass=1" className="underline underline-offset-4">افتح البطاقة في المحرر المحلي</Link>
        </nav>
      </header>
      <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0">
          <div data-ribbon-pass-screen data-before={before} className="relative mx-auto isolate overflow-hidden rounded-[22px] border border-black/10 shadow-lg"
            style={{ width: `min(100%, ${width}px)`, aspectRatio: `${width}/${height}`, background: variant.palette.bg, color: variant.palette.fg }}>
            {layout.page.slot && variant.assets[layout.page.slot] &&
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={variant.assets[layout.page.slot]} alt="" className="pointer-events-none absolute inset-0 h-full w-full" style={{ objectFit: layout.page.fit }} />}
            {layout.page.overlayOpacity > 0 && <div className="pointer-events-none absolute inset-0" style={{ background: layout.page.overlayColor, opacity: layout.page.overlayOpacity }} />}
            {/* Exactly the guest pass's 12rem vertical reserve and 900:1700 stage. */}
            <div className="absolute inset-0 flex items-center justify-center px-6 py-24">
              <div data-ribbon-pass-stage className="w-full" style={{ maxWidth: Math.min(416, (height - 192) * 900 / 1700) }}>
                <ThemeStage key={`${variant.slug}-${before}-${small}-${long}-${coupleCount}-${noQr}-${extra}`}
                  layout={layout} typography={typography} palette={variant.palette} assets={variant.assets} overrides={variant.overrides}
                  content={content} scene="pass" breakpoint="base" qrDataUrl={noQr ? null : qrDataUrl} hasQr={!noQr}
                  style={{ backgroundColor: "transparent" }} />
              </div>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-[390px] px-3 text-center text-sm leading-6 text-fg-muted">الرمز هنا للاختبار فقط، ولا يصلح للدخول. رمز الضيف الحقيقي وآلية تأكيد الحضور لم يتغيرا.</p>
        </div>
        <aside className="mx-3 space-y-6 rounded-2xl border border-border bg-bg p-5 sm:mx-0">
          <fieldset><legend className="mb-3 text-sm font-semibold">لون التصميم</legend><div className="flex flex-col gap-2">
            {variants.map((item, index) => <button key={item.slug} type="button" aria-pressed={variantIndex === index}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-start text-sm aria-pressed:border-current/25 aria-pressed:bg-surface focus-visible:outline-2"
              onClick={() => setVariantIndex(index)}><span aria-hidden className="h-4 w-4 rounded-full border border-black/10" style={{ background: item.palette.swatch }} />{item.name}</button>)}
          </div></fieldset>
          <fieldset><legend className="mb-3 text-sm font-semibold">قارن التنسيق</legend><div className="flex gap-2">
            <button type="button" className={control} aria-pressed={!before} onClick={() => setBefore(false)}>بعد</button>
            <button type="button" className={control} aria-pressed={before} onClick={() => setBefore(true)}>قبل</button>
          </div></fieldset>
          <div className="flex flex-col gap-2">
            <button type="button" className={control} aria-pressed={small} onClick={() => setSmall(!small)}>جوال صغير 320</button>
            <button type="button" className={control} aria-pressed={long} onClick={() => setLong(!long)}>أسماء وتفاصيل طويلة</button>
            <label className="flex items-center justify-between gap-2 text-sm">عدد الأزواج
              <select aria-label="عدد الأزواج" value={coupleCount} onChange={(e) => setCoupleCount(Number(e.target.value))} className="min-h-11 rounded-lg border bg-bg px-3">
                <option value={1}>١</option><option value={2}>٢</option><option value={4}>٤</option>
              </select>
            </label>
            <button type="button" className={control} aria-pressed={extra} onClick={() => setExtra(!extra)}>نص إضافي للدعوة</button>
            <button type="button" className={control} aria-pressed={noQr} onClick={() => setNoQr(!noQr)}>بطاقة بدون باركود</button>
          </div>
          <p className="text-xs leading-6 text-fg-muted">خط أميري للأسماء والتفاصيل، وبيانات المدعو مرتبطة بالدعوة. الصور والإطار وموضع الرمز كما هي، والتنسيق قابل للتعديل من المحرر.</p>
        </aside>
      </div>
    </div>
  </main>;
}
