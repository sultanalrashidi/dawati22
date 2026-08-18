/**
 * Category-level decorative motif kits. One kit per Theme.category, not per
 * theme — every theme in a category shares its kit but renders it in that
 * theme's own accent color, so all 43 themes get a distinct decorative
 * personality without hand-authoring bespoke artwork per theme.
 */
import type { ReactNode } from "react";

type Kit = (props: { accent: string; fgMuted: string }) => ReactNode;

function LuxuryKit({ accent }: { accent: string; fgMuted: string }) {
  const bracket = "M1 13 V5 Q1 1 5 1 H13";
  const positions = [
    "absolute start-5 top-5",
    "absolute end-5 top-5 -scale-x-100",
    "absolute start-5 bottom-5 -scale-y-100",
    "absolute end-5 bottom-5 -scale-x-100 -scale-y-100",
  ];
  return (
    <>
      {positions.map((cls, i) => (
        <svg key={i} className={`${cls} h-4 w-4`} viewBox="0 0 14 14">
          <path d={bracket} fill="none" stroke={accent} strokeWidth="1" opacity="0.65" />
        </svg>
      ))}
    </>
  );
}

function MinimalKit({ accent }: { accent: string; fgMuted: string }) {
  return (
    <svg className="absolute inset-x-0 top-10 mx-auto h-6 w-24" viewBox="0 0 96 24">
      <line x1="0" y1="12" x2="38" y2="12" stroke={accent} strokeWidth="1" opacity="0.6" />
      <circle cx="48" cy="12" r="3" fill="none" stroke={accent} strokeWidth="1" opacity="0.8" />
      <line x1="58" y1="12" x2="96" y2="12" stroke={accent} strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

function SaudiKit({ accent }: { accent: string; fgMuted: string }) {
  const zigzag = "M0 6 L8 0 L16 6 L24 0 L32 6 L40 0 L48 6 L56 0 L64 6 L72 0 L80 6 L88 0 L96 6";
  return (
    <>
      <svg className="absolute inset-x-0 top-0 h-3 w-full opacity-40" viewBox="0 0 96 6" preserveAspectRatio="none">
        <path d={zigzag} fill="none" stroke={accent} strokeWidth="1" />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 h-3 w-full opacity-40" viewBox="0 0 96 6" preserveAspectRatio="none">
        <path d={zigzag} fill="none" stroke={accent} strokeWidth="1" />
      </svg>
    </>
  );
}

function RomanticKit({ accent }: { accent: string; fgMuted: string }) {
  const sprig = (
    <g stroke={accent} strokeWidth="1" fill="none" opacity="0.7">
      <path d="M0 30 Q10 10 4 0" />
      <ellipse cx="6" cy="8" rx="3" ry="1.6" transform="rotate(-30 6 8)" />
      <ellipse cx="8" cy="16" rx="3" ry="1.6" transform="rotate(20 8 16)" />
      <ellipse cx="4" cy="22" rx="3" ry="1.6" transform="rotate(-10 4 22)" />
    </g>
  );
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g className="dawati-decor-sway" transform="translate(10,6)">{sprig}</g>
      <g className="dawati-decor-sway" transform="translate(88,84) rotate(180)">{sprig}</g>
    </svg>
  );
}

function BotanicalKit({ accent }: { accent: string; fgMuted: string }) {
  return (
    <svg className="absolute inset-y-6 start-2 h-[calc(100%-3rem)] w-8" viewBox="0 0 24 160" preserveAspectRatio="none">
      <g className="dawati-decor-float-slow" stroke={accent} strokeWidth="1" fill="none" opacity="0.55">
        <path d="M12 0 V160" />
        {Array.from({ length: 6 }, (_, i) => {
          const y = 14 + i * 26;
          const dir = i % 2 === 0 ? 1 : -1;
          return <path key={i} d={`M12 ${y} Q${12 + dir * 14} ${y + 6} ${12 + dir * 10} ${y + 16}`} />;
        })}
      </g>
    </svg>
  );
}

function DarkKit({ accent }: { accent: string; fgMuted: string }) {
  const rays = Array.from({ length: 7 }, (_, i) => {
    const angle = -60 + i * 20;
    const rad = (angle * Math.PI) / 180;
    return <line key={i} x1="0" y1="0" x2={Math.sin(rad) * 34} y2={Math.cos(rad) * -34} />;
  });
  return (
    <svg className="absolute inset-x-0 top-6 mx-auto h-16 w-16" viewBox="-40 -40 80 40">
      <g stroke={accent} strokeWidth="1" opacity="0.5">{rays}</g>
    </svg>
  );
}

function ExperimentalKit({ accent }: { accent: string; fgMuted: string }) {
  return (
    <>
      <svg className="absolute inset-y-6 start-6 h-[calc(100%-3rem)] w-px" viewBox="0 0 1 100" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="0" y2="100" stroke={accent} strokeWidth="1" opacity="0.2" />
      </svg>
      <svg className="absolute inset-y-6 end-6 h-[calc(100%-3rem)] w-px" viewBox="0 0 1 100" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="0" y2="100" stroke={accent} strokeWidth="1" opacity="0.2" />
      </svg>
      <div className="dawati-decor-scan absolute inset-x-6 h-px" style={{ background: accent, opacity: 0.55 }} />
    </>
  );
}

const KITS: Record<string, Kit> = {
  luxury: LuxuryKit,
  minimal: MinimalKit,
  saudi: SaudiKit,
  romantic: RomanticKit,
  botanical: BotanicalKit,
  dark: DarkKit,
  experimental: ExperimentalKit,
};

export function ThemeDecor({ category, accent, fgMuted }: { category: string; accent: string; fgMuted: string }) {
  const Kit = KITS[category];
  if (!Kit) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Kit accent={accent} fgMuted={fgMuted} />
    </div>
  );
}
