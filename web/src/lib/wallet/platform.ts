/**
 * Which wallet button a guest should be offered, decided from her device.
 *
 * The two wallets are not alternatives a guest chooses between — each phone
 * has exactly one. Google Wallet has no iOS app at all, so its button on an
 * iPhone is a dead end: the save link succeeds, the pass lands in a Google
 * account she cannot open on that phone. Apple Wallet does not exist off
 * Apple hardware. Showing both everywhere would mean showing every guest one
 * button that cannot work.
 */

export type WalletTarget = "apple" | "google";

/** Which passes the environment is actually configured to issue. */
export type WalletAvailability = { apple: boolean; google: boolean };

/**
 * A Mac is the one device that legitimately gets both.
 *
 * Partly because both work there — a .pkpass opens in Wallet on macOS, and
 * Google's save link is a web page — and partly as cover for iPadOS, whose
 * Safari has claimed to be "Macintosh; Intel Mac OS X" since iPadOS 13. There
 * is no reliable way to tell that iPad from a real Mac server-side, and
 * offering both is the answer that is right either way.
 */
function platformOf(userAgent: string): "ios" | "android" | "mac" | "other" {
  const ua = userAgent.toLowerCase();
  // Order matters: an iPad in desktop mode says "macintosh", so the explicit
  // iOS markers have to be tested first for the devices that still send them.
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/macintosh|mac os x/.test(ua)) return "mac";
  return "other";
}

/**
 * What each platform is offered, as an ordered preference.
 *
 * `all` is the exception, not the rule: a phone gets exactly one button — the
 * first entry its environment can actually issue — because a guest holding an
 * iPhone has no use for a second wallet she cannot install. A Mac takes both,
 * since both genuinely work there and it stands in for the iPad that claims
 * to be one.
 */
const RULES: Record<ReturnType<typeof platformOf>, { order: WalletTarget[]; all: boolean }> = {
  ios: { order: ["apple", "google"], all: false },
  android: { order: ["google"], all: false },
  mac: { order: ["apple", "google"], all: true },
  other: { order: ["google"], all: false },
};

/**
 * The buttons to render, in the order they should appear.
 *
 * An unconfigured wallet is filtered out before the preference is applied
 * rather than reasoned about inside it, which is what lets Apple ship later
 * without this function changing: today `apple` is false everywhere, so an
 * iPhone falls through to Google exactly as it does now, and the day the
 * certificate lands every iPhone switches to Apple alone on its own.
 *
 * That fallback is deliberate. A Google pass on an iPhone is close to
 * useless, but it still beats an invitation with no wallet button at all on
 * the most common phone at a Saudi wedding — and it is temporary.
 *
 * A missing User-Agent is treated as a Mac: offer whatever exists rather than
 * guess, since the one thing worse than the wrong button is no button.
 */
export function walletTargetsFor(
  userAgent: string | null,
  available: WalletAvailability,
): WalletTarget[] {
  const rule = RULES[userAgent === null ? "mac" : platformOf(userAgent)];
  const usable = rule.order.filter((target) => available[target]);
  return rule.all ? usable : usable.slice(0, 1);
}
