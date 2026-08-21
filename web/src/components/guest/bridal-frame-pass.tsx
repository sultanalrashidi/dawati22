/**
 * The final "you're confirmed" screen for the bridal-frame theme — a formal
 * entry pass laid out on the client's own card art, filled with the real
 * event details and the guest's actual check-in QR in the frame the artwork
 * already has printed near the bottom.
 */

import type { ReactNode } from "react";

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
  groomLabel,
  brideLabel,
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
  groomLabel: string;
  brideLabel: string;
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

  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/themes/${assetFolder}/pass-card.jpg`} alt="" className="block h-auto max-h-[70vh] w-auto" />

      <div
        className="absolute inset-x-[16%] flex flex-col items-center justify-start gap-1.5 text-center"
        style={{ top: textTop, fontFamily: fontAr }}
      >
        <p className="text-[9px] leading-snug sm:text-[10px]" style={{ color: INK_LIGHT }}>
          {invitationTextAr}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-base sm:text-lg" style={{ color: INK_DARK, fontFamily: nameFont }}>
            {brideLabel}
          </span>
          <span className="text-xs" style={{ color: INK_LIGHT }}>
            &amp;
          </span>
          <span className="text-base sm:text-lg" style={{ color: INK_DARK, fontFamily: nameFont }}>
            {groomLabel}
          </span>
        </div>
        <p className="text-[9px] sm:text-[10px]" style={{ color: INK_LIGHT }}>
          {godWillingLabel}
        </p>
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
