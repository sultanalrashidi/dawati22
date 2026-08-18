import type { CSSProperties } from "react";

interface Particle {
  type: "heart-filled" | "heart-outline";
  left: number; // %
  size: number; // px
  riseDuration: number; // s
  riseDelay: number; // s — negative starts the particle already mid-flight
  swayDuration: number; // s
  swayAmount: number; // px
}

// Deterministic (no Math.random) so server/client markup match — a handful
// of particles, spread and staggered by hand rather than randomized.
const PARTICLES: Particle[] = [
  { type: "heart-filled", left: 10, size: 12, riseDuration: 34, riseDelay: -6, swayDuration: 8, swayAmount: 10 },
  { type: "heart-outline", left: 28, size: 11, riseDuration: 40, riseDelay: -22, swayDuration: 9.5, swayAmount: 8 },
  { type: "heart-filled", left: 50, size: 13, riseDuration: 31, riseDelay: -13, swayDuration: 7, swayAmount: 13 },
  { type: "heart-outline", left: 70, size: 12, riseDuration: 37, riseDelay: -28, swayDuration: 8.5, swayAmount: 11 },
  { type: "heart-filled", left: 88, size: 11, riseDuration: 35, riseDelay: -17, swayDuration: 8, swayAmount: 9 },
];

function HeartFilled({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path
        fill={color}
        d="M12 21s-7.5-4.6-10-9.2C.6 8.6 2 5 5.5 5c2 0 3.4 1.1 4.2 2.4C10.5 6.1 11.9 5 13.9 5 17.4 5 19 8.6 17.7 11.8 15.2 16.4 12 21 12 21Z"
      />
    </svg>
  );
}

function HeartOutline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        d="M12 21s-7.5-4.6-10-9.2C.6 8.6 2 5 5.5 5c2 0 3.4 1.1 4.2 2.4C10.5 6.1 11.9 5 13.9 5 17.4 5 19 8.6 17.7 11.8 15.2 16.4 12 21 12 21Z"
      />
    </svg>
  );
}

const KIND_TO_ICON = { "heart-filled": HeartFilled, "heart-outline": HeartOutline };

/** A few small hearts drifting slowly upward — an ambient, opt-in decorative layer (ThemeConfig.particles). */
export function FloatingParticles({ accent }: { accent: string }) {
  return (
    <div className="dawati-particles-layer pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((p, i) => {
        const Icon = KIND_TO_ICON[p.type];
        return (
          <div
            key={i}
            className="dawati-particle-rise absolute bottom-0"
            style={{
              left: `${p.left}%`,
              animationDuration: `${p.riseDuration}s`,
              animationDelay: `${p.riseDelay}s`,
            }}
          >
            <div
              className="dawati-particle-sway"
              style={{
                width: p.size,
                height: p.size,
                animationDuration: `${p.swayDuration}s`,
                "--dawati-sway": `${p.swayAmount}px`,
              } as CSSProperties & Record<string, string | number>}
            >
              <Icon color={accent} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
