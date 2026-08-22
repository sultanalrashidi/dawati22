/**
 * The very first thing a guest sees: a closed, sealed invitation card — no
 * names yet, one tap to open. Each theme gets its own bespoke card design
 * (rolled out one theme at a time — see `ThemeConfig.card`). This file only
 * ever renders when a theme actually opts in via `card.style`; every other
 * theme keeps using its original cover UI in invitation-view.tsx untouched.
 */

/**
 * A pressed wax-seal medallion carrying the couple's initials. The wax photo
 * itself is recolored per color variant (see /public/themes/{assetFolder}/seal.png).
 * The initials are colored close to the wax itself and shaded with a dark
 * inner-edge + light outer-edge text-shadow so they read as pressed/engraved
 * into the wax rather than printed flat on top of it.
 */
function WaxSeal({
  groomInitial,
  brideInitial,
  assetFolder,
}: {
  groomInitial: string;
  brideInitial: string;
  assetFolder: string;
}) {
  return (
    <div className="relative h-16 w-16 sm:h-20 sm:w-20" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.45))" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/themes/${assetFolder}/seal.png`} alt="" className="block h-full w-full object-contain" />
      <span
        className="absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2 text-lg font-medium sm:text-xl"
        style={{
          fontFamily: "var(--font-cormorant)",
          color: "var(--color-accent)",
          textShadow: "-1px -1px 1px rgba(0,0,0,0.55), 1px 1px 1px rgba(255,255,255,0.35)",
        }}
      >
        {brideInitial}
        <span style={{ margin: "0 0.05em" }}>&amp;</span>
        {groomInitial}
      </span>
    </div>
  );
}

const BRIDAL_FRAME_DEFAULT_CLOSED_ASPECT = "1200/727";
const BRIDAL_FRAME_DEFAULT_SEAL_POSITION = { left: "50%", top: "62.8%" };

/** The envelope's own printed medallion carries the couple's initials directly — no separate wax photo. */
function BridalFrameMonogram({
  groomInitial,
  brideInitial,
  position = BRIDAL_FRAME_DEFAULT_SEAL_POSITION,
}: {
  groomInitial: string;
  brideInitial: string;
  position?: { left: string; top: string };
}) {
  return (
    <span
      className="absolute text-base font-medium sm:text-lg"
      style={{
        left: position.left,
        top: position.top,
        transform: "translate(-50%, -50%)",
        fontFamily: "var(--font-amiri)",
        color: "var(--color-accent)",
        textShadow: "0 1px 1px rgba(255,255,255,0.6), 0 -1px 1px rgba(0,0,0,0.12)",
      }}
    >
      {brideInitial}
      <span style={{ margin: "0 0.15em" }}>&amp;</span>
      {groomInitial}
    </span>
  );
}

/** The client's own envelope photo — a floral scalloped medallion with the couple's initials printed directly on it. */
function BridalFrameCard({
  groomInitial,
  brideInitial,
  isOpening,
  assetFolder,
  closedAspect = BRIDAL_FRAME_DEFAULT_CLOSED_ASPECT,
  sealPosition = BRIDAL_FRAME_DEFAULT_SEAL_POSITION,
}: {
  groomInitial: string;
  brideInitial: string;
  isOpening: boolean;
  assetFolder: string;
  closedAspect?: string;
  sealPosition?: { left: string; top: string };
}) {
  return (
    <div
      className="relative w-72 overflow-hidden rounded-md shadow-2xl sm:w-96"
      style={{
        aspectRatio: closedAspect,
        transition: "transform 550ms cubic-bezier(0.4,0,0.2,1), filter 550ms ease",
        transform: isOpening ? "scale(1.05) translateY(-8px)" : "scale(1)",
        filter: isOpening ? "brightness(1.15)" : "brightness(1)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/themes/${assetFolder}/envelope-closed.webp`} alt="" className="block h-full w-full object-cover" />
      <BridalFrameMonogram groomInitial={groomInitial} brideInitial={brideInitial} position={sealPosition} />
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

/** The client's own envelope photo, with a pressed wax-seal monogram and a tap "lift + shine" reaction. */
function RoseEmbossCard({
  groomInitial,
  brideInitial,
  isOpening,
  assetFolder,
}: {
  groomInitial: string;
  brideInitial: string;
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
        <WaxSeal groomInitial={groomInitial} brideInitial={brideInitial} assetFolder={assetFolder} />
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
  style,
  fg,
  groomInitial,
  brideInitial,
  label,
  onOpen,
  isOpening,
  assetFolder = "rose-candlelight",
  closedAspect,
  sealPosition,
}: {
  style: "rose-emboss" | "bridal-frame";
  accent: string;
  accentFg: string;
  surface: string;
  fg: string;
  groomInitial: string;
  brideInitial: string;
  label: string;
  onOpen: () => void;
  isOpening: boolean;
  assetFolder?: string;
  /** bridal-frame only — overrides for a variant whose art has different proportions/hotspots than the base. */
  closedAspect?: string;
  sealPosition?: { left: string; top: string };
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isOpening}
      className="relative flex flex-col items-center gap-6"
      style={{ opacity: isOpening ? 0 : 1, transition: "opacity 0.35s ease 0.35s" }}
    >
      {style === "bridal-frame" ? (
        <BridalFrameCard
          groomInitial={groomInitial}
          brideInitial={brideInitial}
          isOpening={isOpening}
          assetFolder={assetFolder}
          closedAspect={closedAspect}
          sealPosition={sealPosition}
        />
      ) : (
        <RoseEmbossCard
          groomInitial={groomInitial}
          brideInitial={brideInitial}
          isOpening={isOpening}
          assetFolder={assetFolder}
        />
      )}
      <span className="text-xs font-medium uppercase tracking-[0.3em]" style={{ color: fg }}>
        {label}
      </span>
    </button>
  );
}
