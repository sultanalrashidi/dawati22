/**
 * The final "you're confirmed" screen for the rose-emboss theme — a formal
 * entry pass laid out on the client's own card art, filled with the real
 * event details and the guest's actual check-in QR in the code box the
 * artwork already has printed on it.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { ROSE_EMBOSS_PASS_ART, passCardArt, passCardWidth } from "@/components/guest/pass-card-art";

const INK_DARK = "#3d2417";
const INK_MID = "#5b3a22";
const INK_LIGHT = "#8a5a3a";

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

export function RoseCandlelightPass({
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
  assetFolder = "rose-candlelight",
}: {
  /** Every couple on the invitation, in order. Never empty. */
  couples: { groomLabel: string; brideLabel: string }[];
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
}) {
  // The names sit in a fixed band of the printed card art, between the
  // invitation line and the info icons, and that band is only tall enough for
  // one couple plus its two flourish lines. A joint wedding therefore keeps
  // the names — the reason the card exists — and drops the flourishes, which
  // the guest has already read on the way here. The block is scaled on top of
  // that so three or four couples still clear the icons.
  const joint = couples.length > 1;
  const blockScale = !joint ? 1 : couples.length >= 4 ? 0.55 : couples.length === 3 ? 0.7 : 0.9;
  const art = passCardArt(assetFolder, ROSE_EMBOSS_PASS_ART);

  return (
    // Sized exactly as the bridal-frame pass is, and for the same reason: the
    // overlays and the QR window are percentages of this box, so the box is
    // measured in CSS instead of being read off the fetched file. This card's
    // own ceiling is 58vh rather than 70vh.
    <div className="relative" style={{ width: passCardWidth(art, "58vh") }}>
      <Image
        src={`/themes/${assetFolder}/pass-card.jpg`}
        alt=""
        width={art.width}
        height={art.height}
        sizes="(max-width: 640px) 100vw, 60vh"
        className="block h-auto w-full"
      />

      <div
        className="absolute inset-x-[19%] flex flex-col items-center justify-start gap-1 text-center"
        style={{ top: "28.5%", fontFamily: fontAr, transform: `scale(${blockScale})`, transformOrigin: "top center" }}
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
                {couple.brideLabel}
              </span>
              <span className="text-xs" style={{ color: INK_LIGHT }}>
                &amp;
              </span>
              <span className="text-base sm:text-lg" style={{ color: INK_DARK, fontFamily: nameFont }}>
                {couple.groomLabel}
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

      <div className="absolute inset-x-[12.7%] flex items-start justify-around" style={{ top: "45.1%" }}>
        <InfoColumn icon={<PlaceIcon />} label={placeLabel} value={placeText} />
        <InfoColumn icon={<CalendarIcon />} label={dateLabel} value={dateText} />
        <InfoColumn icon={<ClockIcon />} label={timeLabel} value={timeText} />
      </div>

      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={{ left: "32.3%", width: "35.5%", top: "63%", height: "24%" }}
      >
        {qrNode}
      </div>
    </div>
  );
}
