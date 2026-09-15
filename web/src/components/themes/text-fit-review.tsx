'use client';

import { ThemeStage } from './builder/theme-stage';
import { REFERENCE_STAGE_WIDTH } from './builder/layers/style';
import { resolveContent, SAMPLE_CONTENT_INPUT } from '@/lib/themes/builder/content';
import { guestStageWidth, stageKindFor, type GuestPhone } from '@/lib/themes/builder/stage-size';
import type { LayoutDoc, TypographyDoc, VariantPalette } from '@/lib/themes/builder/types';
import type { LayoutOverrides } from '@/lib/themes/builder/resolve';

export type TextFitDesign = {
  family: string;
  name: string;
  layout: LayoutDoc;
  typography: TypographyDoc;
  /** One entry per distinct arrangement: colours that differ only in colour share one. */
  variants: { slugs: string[]; palette: VariantPalette; assets: Record<string, string>; overrides: LayoutOverrides }[];
};

/**
 * The longest Hijri date line of the next two years — «الأربعاء، ٢٤ جمادى
 * الأولى ١٤٤٨ هـ» — at 8 PM Riyadh time.
 */
const LONG_DATE = '2026-11-04T17:00:00.000Z';

/**
 * Every screen of every design, each stage exactly as wide as the guest page
 * makes it on one phone, so a script can list the text boxes that FittedText
 * had to turn into scrollers there. The artwork is left out unless asked for:
 * it never changes how text fits.
 */
export function TextFitReview({ designs, phone, reference, long, venue, scenes, images, qrDataUrl }: {
  designs: TextFitDesign[];
  phone: GuestPhone;
  /** Every stage at the 390px the designer arranges against, instead of the phone's width. */
  reference: boolean;
  /** Long names, a long venue and the widest date instead of the sample. */
  long: boolean;
  /** A venue name to try instead. */
  venue?: string;
  /** Only these screens, by scene id; every visible one when absent. */
  scenes?: string[];
  /** Draw the artwork on the phone's screen, for looking rather than measuring. */
  images: boolean;
  qrDataUrl: string;
}) {
  const eventDate = long ? LONG_DATE : SAMPLE_CONTENT_INPUT.eventDate;
  const content = resolveContent({
    ...SAMPLE_CONTENT_INPUT,
    eventDate,
    ...(long && {
      guestName: 'الجوهرة بنت عبدالرحمن عبدالعزيز',
      locationName: 'قاعة الاحتفالات الكبرى في فندق الرياض — المدخل الشرقي',
      couples: [{ ...SAMPLE_CONTENT_INPUT.couples[0], brideNameAr: 'الجوهرة عبدالله', groomNameAr: 'عبدالرحمن عبدالعزيز' }],
    }),
    ...(venue && { locationName: venue }),
  });
  const framed = images && !reference;
  return (
    <main dir="rtl" className="flex flex-wrap items-start gap-4 bg-[#f6f2ec] p-4">
      {designs.flatMap(design => design.layout.scenes.filter(scene => scene.visible && (!scenes || scenes.includes(scene.id))).flatMap(scene => design.variants.map(variant => {
        const key = `${design.family}-${scene.id}-${variant.slugs[0]}`;
        const stage = (
          <div key={key} data-stage data-design={design.family} data-scene={scene.id} data-variants={variant.slugs.join(',')}
            style={{ width: reference ? REFERENCE_STAGE_WIDTH : guestStageWidth(scene.canvas, stageKindFor(scene.role), phone) }}>
            <ThemeStage scene={scene.id} layout={design.layout} typography={design.typography} palette={variant.palette}
              assets={images ? variant.assets : {}} eagerImages={images} overrides={variant.overrides} breakpoint="base"
              style={framed ? { backgroundColor: 'transparent' } : undefined}
              content={content} qrDataUrl={qrDataUrl} hasQr={scene.role !== 'passNoQr'} eventDateIso={eventDate}
              mapUrl="https://maps.google.com/?q=24.7136,46.6753"
              scheduleItems={[{ time: '٨:٠٠ م', labelAr: 'استقبال الضيوف' }, { time: '٩:٣٠ م', labelAr: 'الزفة' }, { time: '١٠:٣٠ م', labelAr: 'العشاء' }]}
              notesAr={'يرجى إبراز بطاقة الدخول عند الوصول\nنعتذر عن استقبال الأطفال\nيرجى عدم التصوير احترامًا للخصوصية'}
              rsvp={{ guestName: content.guestName, allowedCount: 4, allowGuestPartySize: true, simulate: true, onResponded: () => {} }} />
          </div>
        );
        if (!framed) return stage;
        // The phone's screen round the stage, with the page artwork covering it
        // the way the guest page lays it behind every screen.
        const { page } = design.layout;
        const background = page.slot ? variant.assets[page.slot] : undefined;
        return (
          <div key={key} data-frame className="relative isolate flex items-center justify-center overflow-hidden"
            style={{ width: phone.width, height: phone.height, background: variant.palette.bg }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {background && <img src={background} alt="" className="absolute inset-0 -z-10 h-full w-full" style={{ objectFit: page.fit }} />}
            {page.overlayOpacity > 0 && <div className="absolute inset-0 -z-10" style={{ background: page.overlayColor, opacity: page.overlayOpacity }} />}
            {stage}
          </div>
        );
      })))}
    </main>
  );
}
