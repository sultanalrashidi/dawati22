import type { SceneCanvas, SceneRole } from "./types";

/**
 * How wide a builder stage is on a guest's phone.
 *
 * Every screen of the invitation is a full-height scroll-snap section padded
 * 1.5rem at each side (`.dawati-scene` in globals.css). Inside it the stage
 * fills the width, capped at 26rem and at the width that keeps the whole scene
 * visible in the height left over: the cover reserves 9rem of it, each flow
 * screen 10rem and the entry pass 12rem, and a page with a fixed bottom bar
 * (the owner's preview bar) reserves that bar's height as well.
 *
 * The invitation scrolls inside its own container, never the document, so a
 * mobile browser's address and tool bars never collapse: the height that
 * counts is the visible viewport with them showing.
 */
export const STAGE_RESERVE = { cover: "9rem", flow: "10rem", pass: "12rem" } as const;
/** What a stage reserves against. */
export type StageKind = keyof typeof STAGE_RESERVE;

/** Both entry passes, with and without the QR, sit on the same screen. */
export function stageKindFor(role: SceneRole): StageKind {
  return role === "passNoQr" ? "pass" : role;
}

const REM = 16;
const SIDE_PADDING = 1.5 * REM;
const MAX_WIDTH = 26 * REM;

/** The CSS max-width the guest page gives a stage of this canvas. */
export function stageMaxWidth(canvas: SceneCanvas, reserve: string): string {
  // The page's fixed bottom chrome (see `bottomInset`) is space the stage
  // cannot use either.
  return `min(26rem, calc((100dvh - ${reserve} - var(--dawati-bottom-inset, 0px)) * ${canvas.aspectW} / ${canvas.aspectH}))`;
}

/** The same width in px, for a known viewport. */
export function guestStageWidth(
  canvas: Pick<SceneCanvas, "aspectW" | "aspectH">,
  kind: StageKind,
  viewport: { width: number; height: number; bottomInset?: number },
): number {
  const reserved = Number.parseFloat(STAGE_RESERVE[kind]) * REM + (viewport.bottomInset ?? 0);
  return Math.min(viewport.width - 2 * SIDE_PADDING, MAX_WIDTH, ((viewport.height - reserved) * canvas.aspectW) / canvas.aspectH);
}

/**
 * Phones common in Saudi Arabia, each with the height a page really gets while
 * the browser's bars are showing — the smallest it will see.
 *
 * - Android, Chrome: the screen less a 24px status bar, a 56px toolbar and a
 *   48px three-button navigation bar (gesture navigation gives ~24px more).
 * - iPhone, Safari with its bottom tab bar: the SE keeps 548 of its 667px;
 *   a 390px iPhone 664 of 844; a Pro Max / Plus 739 of 932.
 */
export const GUEST_PHONES = [
  { id: "android-360", label: "أندرويد ٣٦٠×٧٨٠", width: 360, height: 652 },
  { id: "iphone-se", label: "آيفون SE", width: 375, height: 548 },
  { id: "iphone-390", label: "آيفون ١٢–١٦", width: 390, height: 664 },
  { id: "android-412", label: "أندرويد ٤١٢×٩١٥", width: 412, height: 787 },
  { id: "iphone-430", label: "آيفون برو ماكس", width: 430, height: 739 },
] as const;
export type GuestPhone = (typeof GUEST_PHONES)[number];
