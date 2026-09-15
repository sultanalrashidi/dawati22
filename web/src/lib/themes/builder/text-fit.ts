/**
 * How far a fitted text box may shrink its text.
 *
 * Pure on purpose: the renderer (`FittedText`) and the tests read the same
 * rule from here.
 */

/**
 * The smallest a fitted text may shrink to, in px on the 390px reference stage
 * the designer arranges against.
 *
 * It is a reference size, not a screen size: on a narrower stage it shrinks
 * with everything else. A floor fixed at 14 screen px let a box shrink its text
 * by a quarter at 390px but not at all on an iPhone SE, whose stages are
 * 188–245px wide, so a design that fitted in the editor overflowed on the
 * phone and FittedText turned the box into a scroller that hid the event time.
 */
export const FIT_FLOOR = 14;

/**
 * The fitted minimum for a box whose text is `authoredPx` on screen and was
 * authored at `referencePx` on the reference stage — so `authoredPx /
 * referencePx` is the stage's own scale.
 *
 * Wider than the reference the floor stays at 14px, as it always was, and
 * text never grows past its authored size.
 */
export function fittedFloor(authoredPx: number, referencePx: number): number {
  const scale = referencePx > 0 ? authoredPx / referencePx : 1;
  return Math.min(authoredPx, FIT_FLOOR * Math.min(1, scale));
}
