import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { InvitationView } from "@/components/guest/invitation-view";
import { InvitationStatus, Role, ThemeEngine } from "@/generated/prisma/client";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { mayPreviewDeliveredTheme } from "@/lib/design-requests/service";
import { renderQrDataUrl } from "@/lib/qr";
import { builderThemeConfig, loadBuilderTheme } from "@/lib/themes/builder/guest";
import { builderFontStylesheetHref } from "@/lib/themes/builder/fonts-server";
import { DEFAULT_MUSIC_TRACK, SAMPLE_CONTENT_INPUT, noteLines } from "@/lib/themes/builder/content";
import { defaultLocale } from "@/lib/i18n/locales";
import { prisma } from "@/lib/db/client";
import type { ScheduleItem } from "@/lib/events/types";

/**
 * "Preview Invitation" — the real guest experience, not a mock-up.
 *
 * It mounts the same `InvitationView` a guest gets, with sample data, so a
 * design can be walked end to end (envelope → open → RSVP → entry pass) while
 * it is still a draft and invisible to customers. Outside the admin route tree
 * for chrome reasons, so it carries its own access check.
 *
 * Admin-only, with one deliberate exception: the customer whose own custom
 * design request is waiting on this exact theme. The whole premise of that
 * service is that they decide before paying, which they cannot do without
 * seeing it — and the grant that would put the design in their picker is
 * withheld until the fee is paid, so looking is all this lets them do.
 */
export default async function ThemePreviewPage({
  params,
  searchParams,
}: PageProps<"/theme-preview/[themeId]">) {
  const { themeId } = await params;

  const viewer = await getSessionUser();
  const isRequester =
    viewer?.role === Role.CUSTOMER && (await mayPreviewDeliveredTheme(themeId, viewer.id));
  if (!isRequester) await requireUserOrRedirect(defaultLocale, [Role.ADMIN]);

  const { status, noQr } = await searchParams;
  const dict = await getDictionary("ar");

  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: { id: true, engine: true, category: true, nameAr: true },
  });
  if (!theme || theme.engine !== ThemeEngine.BUILDER) notFound();

  const builder = await loadBuilderTheme(theme.id);
  if (!builder) notFound();

  const fontsHref = await builderFontStylesheetHref(builder.layout, builder.typography);

  // `?status=ACCEPTED` jumps straight to the entry pass, which is otherwise
  // only reachable by filling in the RSVP form on every check.
  const accepted = status === "ACCEPTED";
  // Lets the admin check an uploaded "cardNoQr" image without a real order —
  // the pass otherwise only ever renders without a code for a NO_QR event.
  const hasQr = noQr !== "1";
  const qrDataUrl = accepted && hasQr ? await renderQrDataUrl("preview-sample-token") : null;
  const sample = SAMPLE_CONTENT_INPUT;
  const [primaryCouple] = sample.couples;

  // A scene can declare that it needs the schedule, the notes, a map link or
  // and the guest flow skips it when the event carries none. With an empty
  // sample event every such scene would silently vanish from this preview and
  // read as a broken design, so the sample carries one of each.
  const sampleSchedule: ScheduleItem[] = [
    { labelAr: "استقبال الضيوف", time: "8:00 م" },
    { labelAr: "الزفة", time: "9:30 م" },
    { labelAr: "العشاء", time: "10:30 م" },
  ];
  // All three standard note toggles on, composed exactly as the guest page
  // composes them: standard lines first, then the host's own notes.
  const sampleNoteFlags = { noteNoPhotos: true, noteNoChildren: true, noteShowPass: true };
  const sampleNotes = noteLines(sampleNoteFlags, "يرجى الحضور قبل الموعد بنصف ساعة").join("\n");

  return (
    <>
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}

      <div className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-black/75 px-3 py-1.5 text-[11px] text-white backdrop-blur">
        <span className="opacity-70">معاينة «{theme.nameAr}» — بيانات تجريبية</span>
        <a href={`/theme-preview/${theme.id}`} className="underline">
          من البداية
        </a>
        <a href={`/theme-preview/${theme.id}?status=ACCEPTED`} className="underline">
          بطاقة الدخول
        </a>
        <a href={`/theme-preview/${theme.id}?status=ACCEPTED&noQr=1`} className="underline">
          بطاقة الدخول (بدون باركود)
        </a>
        <a href={`/ar/admin/themes/builder/${theme.id}`} className="underline">
          رجوع للمحرر
        </a>
      </div>

      <InvitationView
        dict={dict}
        mode="preview"
        linkToken="preview"
        theme={builderThemeConfig({ palette: builder.palette, typography: builder.typography })}
        builder={builder}
        themeCategory={theme.category}
        event={{
          name: "معاينة",
          couples: sample.couples,
          groomNameEn: primaryCouple.groomNameEn,
          brideNameEn: primaryCouple.brideNameEn,
          groomNameAr: primaryCouple.groomNameAr,
          groomFamilyAr: primaryCouple.groomFamilyAr,
          brideNameAr: primaryCouple.brideNameAr,
          brideFamilyAr: primaryCouple.brideFamilyAr,
          openingKind: sample.openingKind,
          hostMode: sample.hostMode,
          groomMotherAr: sample.groomMotherAr,
          brideMotherAr: sample.brideMotherAr,
          hostLineAr: sample.hostLineAr,
          coupleFormat: sample.coupleFormat,
          closingAr: sample.closingAr,
          familiesGreetingAr: sample.familiesGreetingAr,
          invitationTextAr: sample.invitationTextAr,
          eventDate: sample.eventDate,
          locationName: sample.locationName,
          regionName: sample.regionName,
          mapUrl: "https://maps.google.com/?q=24.7136,46.6753",
          // The house track, starting with the reveal as it does for a guest.
          // Also opens the gate on any scene the admin marked
          // `requires: "music"`, so the preview proves that scene lays out.
          musicYoutubeId: DEFAULT_MUSIC_TRACK,
          musicAutoplay: true,
          scheduleItems: sampleSchedule,
          notesAr: sampleNotes,
          rsvpRequired: true,
          allowGuestPartySize: true,
        }}
        guest={{ nameAr: sample.guestName, allowedCount: 2 }}
        status={accepted ? InvitationStatus.ACCEPTED : InvitationStatus.SENT}
        hasQr={hasQr}
        qrDataUrl={qrDataUrl}
      />
    </>
  );
}
