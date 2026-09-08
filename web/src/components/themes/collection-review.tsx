'use client';

import { useState } from 'react';
import { ThemeStage } from './builder/theme-stage';
import { resolveContent, SAMPLE_CONTENT_INPUT } from '@/lib/themes/builder/content';
import type { LayoutDoc, TypographyDoc, VariantPalette } from '@/lib/themes/builder/types';
import type { LayoutOverrides } from '@/lib/themes/builder/resolve';

type Variant = { slug: string; name: string; palette: VariantPalette; originalPalette: VariantPalette; assets: Record<string, string>; overrides: LayoutOverrides; originalOverrides: LayoutOverrides };
type Design = { family: string; name: string; layout: LayoutDoc; original: LayoutDoc; typography: TypographyDoc; originalTypography: TypographyDoc; variants: Variant[] };
const SCENES = [['cover', 'الظرف'], ['open', 'فتح الدعوة'], ['greeting', 'الترحيب والأسماء'], ['countdown', 'العد التنازلي'], ['details', 'التفاصيل'], ['schedule', 'البرنامج'], ['notes', 'الملاحظات'], ['rsvp', 'تأكيد الحضور'], ['pass', 'بطاقة الدخول']];

export function CollectionReview({ designs, qrDataUrl }: { designs: Design[]; qrDataUrl: string }) {
  const [scene, setScene] = useState('greeting');
  const [before, setBefore] = useState(false);
  const [long, setLong] = useState(false);
  const [small, setSmall] = useState(false);
  const [filter, setFilter] = useState('all');
  const [responses, setResponses] = useState<Record<string, 'ACCEPTED' | 'DECLINED'>>({});
  const [colours, setColours] = useState<Record<string, number>>({});
  const eventDate = '2026-11-20T18:00:00.000Z';
  const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, eventDate, guestName: long ? 'الجوهرة بنت عبدالرحمن عبدالعزيز' : 'أم فهد',
    locationName: long ? 'قاعة الاحتفالات الكبرى في فندق الرياض — المدخل الشرقي' : 'قاعة الماسة', regionName: 'الرياض',
    couples: [{ ...SAMPLE_CONTENT_INPUT.couples[0], brideNameAr: long ? 'الجوهرة عبدالله' : 'نورة', groomNameAr: long ? 'عبدالرحمن عبدالعزيز' : 'فيصل', brideFamilyAr: null, groomFamilyAr: null }],
  });
  const control = 'rounded-full border border-[#d6cbbd] px-4 py-2 text-sm aria-pressed:bg-[#514638] aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-4';
  return <main dir="rtl" className="min-h-screen bg-[#f6f2ec] px-4 py-8 text-[#342e26] sm:px-8">
    <header className="mx-auto mb-7 max-w-[1500px]">
      <p className="mb-2 text-xs tracking-wide text-[#786b5a]">دعوتي · مجموعة التصاميم</p>
      <h1 className="mb-3 text-3xl">خط واحد، ولكل دعوة شخصيتها</h1>
      <p className="mb-5 text-sm leading-7 text-[#786b5a]">١٢ تصميمًا · ٩٢ نسخة لونية · تنسيق مستوحى من فيونكة الورد. معاينة محلية ببيانات توضيحية.</p>
      <nav aria-label="صفحات الدعوة" className="mb-4 flex flex-wrap gap-2">
        {SCENES.map(([id, label]) => <button key={id} className={control} aria-pressed={scene === id} onClick={() => setScene(id)}>{label}</button>)}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <button className={control} aria-pressed={before} onClick={() => setBefore(!before)}>{before ? 'عرض النتيجة' : 'مقارنة: قبل التعديل'}</button>
        <button className={control} aria-pressed={long} onClick={() => setLong(!long)}>أسماء ونصوص طويلة</button>
        <button className={control} aria-pressed={small} onClick={() => setSmall(!small)}>جوال صغير ٣٢٠</button>
        <label className="mr-auto text-sm">التصميم <select aria-label="اختيار التصميم" value={filter} onChange={e => setFilter(e.target.value)} className="mr-2 rounded-lg border border-[#d6cbbd] bg-white px-3 py-2">
          <option value="all">كل التصاميم</option>{designs.map(d => <option key={d.family} value={d.family}>{d.name}</option>)}
        </select></label>
      </div>
      <p role="status" className="mt-4 text-sm">{before ? 'قبل التعديل' : 'النتيجة بعد التعديل'} · {SCENES.find(([id]) => id === scene)?.[1]}</p>
    </header>
    <div className={`mx-auto grid max-w-[1500px] grid-cols-1 items-start justify-items-center gap-x-6 gap-y-10 ${filter === "all" ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
      {designs.filter(d => filter === 'all' || filter === d.family).map(design => {
        const variant = design.variants[colours[design.family] || 0];
        const layout = before ? design.original : design.layout;
        const palette = before ? variant.originalPalette : variant.palette;
        const canvas = layout.scenes.find(s => s.id === scene)!.canvas;
        const frameWidth = small ? 320 : 390;
        const height = small ? 650 : 780;
        const stageWidth = Math.min(frameWidth - 48, (height - 100) * canvas.aspectW / canvas.aspectH);
        return <section key={design.family} data-design={design.family} className="w-full max-w-[390px]">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg">{design.name}</h2><span className="text-xs text-[#786b5a]">{variant.name}</span></div>
          <div data-design-screen data-scene={scene} className="relative isolate mx-auto overflow-hidden rounded-[20px] shadow-[0_12px_35px_#45351e12]" style={{ width: `min(100%, ${frameWidth}px)`, aspectRatio: `${frameWidth}/${height}`, background: palette.bg, color: palette.fg }}>
            {layout.page.slot && variant.assets[layout.page.slot] &&
              // eslint-disable-next-line @next/next/no-img-element
              <img src={variant.assets[layout.page.slot]} alt="" className="pointer-events-none absolute inset-0 h-full w-full" style={{ objectFit: layout.page.fit }} />}
            {layout.page.overlayOpacity > 0 && <div className="absolute inset-0" style={{ background: layout.page.overlayColor, opacity: layout.page.overlayOpacity }} />}
            <div className="absolute inset-0 flex items-center justify-center px-6 py-12" onClickCapture={e => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}>
              <div className="w-full" style={{ maxWidth: stageWidth }}>
                <ThemeStage key={`${scene}-${variant.slug}-${before}-${long}`} scene={scene} layout={layout} typography={before ? design.originalTypography : design.typography}
                  assets={variant.assets} palette={palette} overrides={before ? variant.originalOverrides : variant.overrides} breakpoint="base" content={content} qrDataUrl={qrDataUrl} style={{ backgroundColor: "transparent" }}
                  eventDateIso={eventDate} mapUrl="https://maps.google.com/?q=24.7136,46.6753"
                  scheduleItems={[{ time: '٨:٠٠ م', labelAr: 'استقبال الضيوف' }, { time: '٩:٣٠ م', labelAr: 'الزفة' }, { time: '١٠:٣٠ م', labelAr: 'العشاء' }]}
                  notesAr={'يرجى إبراز بطاقة الدخول عند الوصول\nنعتذر عن استقبال الأطفال\nيرجى عدم التصوير احترامًا للخصوصية'}
                  rsvpResponded={responses[variant.slug] ?? null}
                  rsvp={{ guestName: content.guestName, allowedCount: 4, allowGuestPartySize: true, simulate: true, onResponded: response => setResponses(current => ({ ...current, [variant.slug]: response })) }} />
              </div>
            </div>
          </div>
          <div aria-label={`ألوان ${design.name}`} className="mt-4 flex flex-wrap justify-center gap-2">{design.variants.map((v, i) => <button key={v.slug} aria-label={`${design.name} — ${v.name}`} title={v.name} aria-pressed={v === variant}
            onClick={() => setColours({ ...colours, [design.family]: i })} className="h-7 w-7 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 aria-pressed:ring-2 aria-pressed:ring-[#514638] aria-pressed:ring-offset-2"
            style={{ background: v.palette.swatch || v.palette.accent }} />)}</div>
        </section>;
      })}
    </div>
  </main>;
}
