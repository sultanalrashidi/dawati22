"use client";

import { useState, type ReactElement } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import { InvitationView } from "@/components/guest/invitation-view";

const SAMPLE_EVENT = {
  name: "Sample",
  groomNameEn: "Faisal",
  brideNameEn: "Noura",
  groomNameAr: "فيصل",
  groomFamilyAr: "آل سعيد",
  brideNameAr: "نورة",
  brideFamilyAr: "آل مطلق",
  familiesGreetingAr: "يسعدنا انضمامكم لنا في هذا اليوم",
  invitationTextAr: "يسعدنا دعوتكم لحضور حفل زفافنا ومشاركتنا فرحتنا",
  eventDate: new Date(Date.now() + 45 * 86_400_000).toISOString(),
  locationName: "قاعة الأمير الكبرى - الرياض",
  mapUrl: "https://maps.google.com/?q=" + encodeURIComponent("قاعة الأمير الكبرى الرياض"),
  // Real, verified-embeddable royalty-free track — lets the customer see and
  // try the music button while browsing themes, not just an empty state.
  musicYoutubeId: "LDnUX_mwx2Q",
  musicAutoplay: false,
  scheduleItems: [
    { labelAr: "استقبال الضيوف", time: "٨:٠٠ م" },
    { labelAr: "الزفة", time: "٩:٠٠ م" },
    { labelAr: "العشاء", time: "١٠:٠٠ م" },
  ],
  notesAr: "عدم اصطحاب الأطفال\nالحضور بالزي الرسمي",
  rsvpRequired: true,
  allowGuestPartySize: true,
};

const SAMPLE_GUEST = { nameAr: "أم عبدالله", allowedCount: 3 };

export function ThemePreviewDialog({
  variants,
  initialVariantId,
  themeCategory,
  dict,
  trigger,
  open,
  onOpenChange,
}: {
  /** All color variants of this design — a single-item array for a standalone (non-family) theme. */
  variants: Array<{ id: string; config: ThemeConfig }>;
  initialVariantId: string;
  themeCategory?: string;
  dict: Dictionary;
  /** A single button-like element (e.g. `<button>...</button>`) — rendered as the trigger itself, not wrapped in one. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [activeId, setActiveId] = useState(initialVariantId);
  const active = variants.find((v) => v.id === activeId) ?? variants[0];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Popup className="fixed inset-0 z-50 overflow-y-auto outline-none">
          <div dir="rtl">
            {variants.length > 1 && (
              <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
                <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-black/40 px-3 py-2 shadow-lg backdrop-blur">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-label={v.config.colorTag ?? v.id}
                      onClick={() => setActiveId(v.id)}
                      className="h-6 w-6 shrink-0 rounded-full transition-transform"
                      style={{
                        background: v.config.palette.swatch ?? v.config.palette.accent,
                        boxShadow: v.id === activeId ? "0 0 0 2px rgba(0,0,0,0.4), 0 0 0 4px #fff" : "none",
                        transform: v.id === activeId ? "scale(1.12)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <Dialog.Close className="fixed start-4 top-4 z-20 flex h-10 items-center gap-1.5 rounded-full bg-black/40 px-4 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/60">
              <span aria-hidden="true">✕</span>
              {dict.themesGallery.exitPreview}
            </Dialog.Close>
            <InvitationView
              key={active.id}
              dict={dict}
              theme={active.config}
              themeCategory={themeCategory}
              event={SAMPLE_EVENT}
              guest={SAMPLE_GUEST}
              status="SENT"
              qrDataUrl={null}
              mode="preview"
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
