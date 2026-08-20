"use client";

import type { ReactElement } from "react";
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
  theme,
  themeCategory,
  dict,
  trigger,
  open,
  onOpenChange,
  previewKey,
}: {
  theme: ThemeConfig;
  themeCategory?: string;
  dict: Dictionary;
  /** A single button-like element (e.g. `<button>...</button>`) — rendered as the trigger itself, not wrapped in one. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Forces InvitationView to remount (resetting its cover/RSVP state) when
   * switching between themes in a shared dialog instance — without this,
   * previewing theme B after accepting the RSVP in theme A's preview would
   * silently reuse theme A's "already accepted" state.
   */
  previewKey?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Popup className="fixed inset-0 z-50 overflow-y-auto outline-none">
          <div dir="rtl">
            <Dialog.Close className="fixed end-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60">
              ✕
            </Dialog.Close>
            <InvitationView
              key={previewKey}
              dict={dict}
              theme={theme}
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
