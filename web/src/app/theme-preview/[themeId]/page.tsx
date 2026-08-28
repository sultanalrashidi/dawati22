import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { InvitationView } from "@/components/guest/invitation-view";
import { InvitationStatus, Role, ThemeEngine } from "@/generated/prisma/client";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { renderQrDataUrl } from "@/lib/qr";
import { builderThemeConfig, loadBuilderTheme } from "@/lib/themes/builder/guest";
import { builderFontStylesheetHref } from "@/lib/themes/builder/fonts-server";
import { SAMPLE_CONTENT_INPUT } from "@/lib/themes/builder/content";
import { defaultLocale } from "@/lib/i18n/locales";
import { prisma } from "@/lib/db/client";
import type { ScheduleItem } from "@/lib/events/types";

/**
 * "Preview Invitation" — the real guest experience, not a mock-up.
 *
 * It mounts the same `InvitationView` a guest gets, with sample data, so a
 * design can be walked end to end (envelope → open → RSVP → entry pass) while
 * it is still a draft and invisible to customers. Outside the admin route tree
 * for chrome reasons, so it carries its own admin check.
 */
export default async function ThemePreviewPage({
  params,
  searchParams,
}: PageProps<"/theme-preview/[themeId]">) {
  await requireUserOrRedirect(defaultLocale, [Role.ADMIN]);

  const { themeId } = await params;
  const { status } = await searchParams;
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
  const qrDataUrl = accepted ? await renderQrDataUrl("preview-sample-token") : null;
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
  const sampleNotes = "يرجى الحضور قبل الموعد بنصف ساعة\nالتصوير مسموح في الصالة الرئيسية فقط";

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
          familiesGreetingAr: sample.familiesGreetingAr,
          invitationTextAr: sample.invitationTextAr,
          eventDate: sample.eventDate,
          locationName: sample.locationName,
          regionName: sample.regionName,
          mapUrl: "https://maps.google.com/?q=24.7136,46.6753",
          // Opens the gate on any scene the admin marked `requires: "music"`;
          // the hidden 1x1 embed is a placeholder, so the preview proves the
          // scene appears and lays out — real audio plays on a real invitation.
          musicYoutubeId: "preview-sample",
          musicAutoplay: false,
          scheduleItems: sampleSchedule,
          notesAr: sampleNotes,
          rsvpRequired: true,
          allowGuestPartySize: true,
        }}
        guest={{ nameAr: sample.guestName, allowedCount: 2 }}
        status={accepted ? InvitationStatus.ACCEPTED : InvitationStatus.SENT}
        qrDataUrl={qrDataUrl}
      />
    </>
  );
}
