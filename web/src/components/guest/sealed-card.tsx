/**
 * The very first thing a guest sees: a closed, sealed invitation card — no
 * names yet, one tap to open. Each theme gets its own bespoke card design
 * (rolled out one theme at a time — see `ThemeConfig.card`). This file only
 * ever renders when a theme actually opts in via `card.style`; every other
 * theme keeps using its original cover UI in invitation-view.tsx untouched.
 */

/**
 * A pressed wax-seal medallion carrying the couple's initials. Colors are
 * derived from the theme's own --color-accent/--color-accent-fg custom
 * properties (set per-theme in invitation-view.tsx) so every color variant
 * gets a seal that matches its own palette automatically.
 */
function WaxSeal({ groomInitial, brideInitial, fontEn }: { groomInitial: string; brideInitial: string; fontEn: string }) {
  return (
    <svg viewBox="0 0 80 80" className="block h-16 w-16 sm:h-20 sm:w-20" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.45))" }}>
      <defs>
        <radialGradient id="sealGrad" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--color-accent) 35%, white)" />
          <stop offset="55%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--color-accent) 75%, black)" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="36" fill="url(#sealGrad)" />
      <circle cx="40" cy="40" r="36" fill="none" stroke="color-mix(in srgb, var(--color-accent) 65%, black)" strokeWidth="0.75" opacity="0.55" />
      <circle cx="40" cy="40" r="30.5" fill="none" stroke="color-mix(in srgb, var(--color-accent) 65%, black)" strokeWidth="0.6" strokeDasharray="1.3 2.6" opacity="0.5" />
      <text
        x="40"
        y="45"
        textAnchor="middle"
        fontSize="19"
        fontFamily={fontEn}
        fill="var(--color-accent-fg)"
      >
        {brideInitial}&amp;{groomInitial}
      </text>
    </svg>
  );
}

/** The client's own envelope photo, with a pressed wax-seal monogram and a tap "lift + shine" reaction. */
function RoseEmbossCard({
  groomInitial,
  brideInitial,
  fontEn,
  isOpening,
  assetFolder,
}: {
  groomInitial: string;
  brideInitial: string;
  fontEn: string;
  isOpening: boolean;
  assetFolder: string;
}) {
  return (
    <div
      className="relative aspect-[1426/1103] w-72 overflow-hidden rounded-md shadow-2xl sm:w-96"
      style={{
        transition: "transform 550ms cubic-bezier(0.4,0,0.2,1), filter 550ms ease",
        transform: isOpening ? "scale(1.05) translateY(-8px)" : "scale(1)",
        filter: isOpening ? "brightness(1.15)" : "brightness(1)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/themes/${assetFolder}/envelope-closed.jpg`} alt="" className="block h-full w-full object-cover" />
      <div className="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2">
        <WaxSeal groomInitial={groomInitial} brideInitial={brideInitial} fontEn={fontEn} />
      </div>
      {/* a soft diagonal light sweep on tap, since a flat photo can't hinge open like the SVG cards */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)",
          transform: isOpening ? "translateX(60%)" : "translateX(-120%)",
          transition: "transform 650ms ease-out",
        }}
      />
    </div>
  );
}

export function SealedCard({
  fg,
  groomInitial,
  brideInitial,
  fontEn,
  label,
  onOpen,
  isOpening,
  assetFolder = "rose-candlelight",
}: {
  style: "rose-emboss";
  accent: string;
  accentFg: string;
  surface: string;
  fg: string;
  groomInitial: string;
  brideInitial: string;
  fontEn: string;
  label: string;
  onOpen: () => void;
  isOpening: boolean;
  assetFolder?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isOpening}
      className="relative flex flex-col items-center gap-6"
      style={{ opacity: isOpening ? 0 : 1, transition: "opacity 0.35s ease 0.35s" }}
    >
      <RoseEmbossCard
        groomInitial={groomInitial}
        brideInitial={brideInitial}
        fontEn={fontEn}
        isOpening={isOpening}
        assetFolder={assetFolder}
      />
      <span className="text-xs font-medium uppercase tracking-[0.3em]" style={{ color: fg }}>
        {label}
      </span>
    </button>
  );
}
