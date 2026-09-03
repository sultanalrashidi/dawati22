/**
 * The final "you're confirmed" screen for the bridal-frame theme — a formal
 * entry pass laid out on the client's own card art, filled with the real
 * event details and the guest's actual check-in QR in the frame the artwork
 * already has printed near the bottom.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { BRIDAL_FRAME_PASS_ART, passCardArt, passCardWidth } from "@/components/guest/pass-card-art";

// Ink colors follow the theme's own fg/fgMuted (inherited CSS vars) so they
// read on both the light ivory-bloom card and the dark (navy/burgundy/mocha/
// noir) variants, instead of assuming a fixed light card color.
const INK_DARK = "var(--color-fg)";
const INK_MID = "var(--color-fg)";
const INK_LIGHT = "var(--color-fg-muted)";

function PlaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke={INK_LIGHT} strokeWidth="1.4">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke={INK_LIGHT} strokeWidth="1.4">
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke={INK_LIGHT} strokeWidth="1.4">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function InfoColumn({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex max-w-[34%] flex-col items-center gap-0.5 text-center">
      {icon}
      <span className="text-[7.5px] uppercase tracking-wide sm:text-[8.5px]" style={{ color: INK_LIGHT }}>
        {label}
      </span>
      <span className="text-[8px] leading-tight sm:text-[9.5px]" style={{ color: INK_MID }}>
        {value}
      </span>
    </div>
  );
}

export function BridalFramePass({
  couples,
  invitationTextAr,
  placeText,
  dateText,
  timeText,
  qrNode,
  fontAr,
  nameFont,
  godWillingLabel,
  placeLabel,
  dateLabel,
  timeLabel,
  assetFolder = "ivory-bloom",
  layout,
}: {
  /** Every couple on the invitation, in order. Never empty. */
  couples: { groomLabel: string; brideLabel: string }[];
  /**
   * The line printed above the names. Never empty: the host's extra text is
   * optional, so the caller passes the composed host line + verb when she
   * wrote none — the card prints the names itself, right under this.
   */
  invitationTextAr: string;
  placeText: string;
  dateText: string;
  timeText: string;
  qrNode: ReactNode;
  fontAr: string;
  nameFont: string;
  godWillingLabel: string;
  placeLabel: string;
  dateLabel: string;
  timeLabel: string;
  assetFolder?: string;
  /** Overrides for a variant whose pass-card art has different proportions/hotspots than the base. */
  layout?: {
    textTop: string;
    iconsTop: string;
    qr: { left: string; width: string; top: string; height: string };
  };
}) {
  const textTop = layout?.textTop ?? "23%";
  const iconsTop = layout?.iconsTop ?? "43%";
  const qr = layout?.qr ?? { left: "38.75%", width: "24.25%", top: "79.7%", height: "10.7%" };

  // The names sit in a fixed band of the printed card art, between the
  // invitation line and the info icons, and that band is only tall enough for
  // one couple plus its two flourish lines. A joint wedding therefore keeps
  // the names — the reason the card exists — and drops the flourishes, which
  // the guest has already read on the way here. The block is scaled on top of
  // that so three or four couples still clear the icons.
  const joint = couples.length > 1;
  const blockScale = !joint ? 1 : couples.length >= 4 ? 0.55 : couples.length === 3 ? 0.7 : 0.9;
  const art = passCardArt(assetFolder, BRIDAL_FRAME_PASS_ART);

  return (
    // Every overlay below is positioned as a PERCENTAGE of this box, so what
    // sizes the box sizes the guest's name, the venue line and the window the
    // QR has to land inside. The width is therefore settled here in CSS rather
    // than read off whatever file the browser decided to fetch — see
    // pass-card-art.ts for what goes wrong when a responsive image is asked to
    // size a layout. The image then simply fills it, and its own proportions
    // still set the height, so nothing here can stretch the artwork.
    <div className="relative" style={{ width: passCardWidth(art, "70vh") }}>
      <Image
        src={`/themes/${assetFolder}/pass-card.jpg`}
        alt=""
        width={art.width}
        height={art.height}
        sizes="(max-width: 640px) 100vw, 60vh"
        className="block h-auto w-full"
      />

      <div
        className="absolute inset-x-[16%] flex flex-col items-center justify-start gap-1.5 text-center"
        style={{ top: textTop, fontFamily: fontAr, transform: `scale(${blockScale})`, transformOrigin: "top center" }}
      >
        {!joint && (
          <p className="text-[9px] leading-snug sm:text-[10px]" style={{ color: INK_LIGHT }}>
            {invitationTextAr}
          </p>
        )}
        {/* One line per couple: a joint wedding used to print the first pair
            and silently drop the rest. The names sit in a fixed band of the
            printed card art — between the invitation text and the info icons —
            so extra pairs step down in size instead of growing into the row
            below. A single couple keeps the original type exactly. */}
        <div className="mt-0.5 flex flex-col items-center" style={{ gap: 0 }}>
          {couples.map((couple, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-base sm:text-lg" style={{ color: INK_DARK, fontFamily: nameFont }}>
                {couple.groomLabel}
              </span>
              <span className="text-xs" style={{ color: INK_LIGHT }}>
                &amp;
              </span>
              <span className="text-base sm:text-lg" style={{ color: INK_DARK, fontFamily: nameFont }}>
                {couple.brideLabel}
              </span>
            </div>
          ))}
        </div>
        {!joint && (
          <p className="text-[9px] sm:text-[10px]" style={{ color: INK_LIGHT }}>
            {godWillingLabel}
          </p>
        )}
      </div>

      <div className="absolute inset-x-[14%] flex items-start justify-around" style={{ top: iconsTop }}>
        <InfoColumn icon={<PlaceIcon />} label={placeLabel} value={placeText} />
        <InfoColumn icon={<CalendarIcon />} label={dateLabel} value={dateText} />
        <InfoColumn icon={<ClockIcon />} label={timeLabel} value={timeText} />
      </div>

      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={{ left: qr.left, width: qr.width, top: qr.top, height: qr.height }}
      >
        {qrNode}
      </div>
    </div>
  );
}
