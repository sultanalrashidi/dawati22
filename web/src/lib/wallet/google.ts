import "server-only";
import { getAppUrl } from "@/lib/urls";

/**
 * Google Wallet — turning a confirmed invitation into a saved event ticket.
 *
 * The pass carries the very same `qrToken` the door scanner already reads, so
 * a guest who saves the ticket and a guest who keeps the web page open are
 * indistinguishable at the gate: one code, one check-in log, no second path
 * to keep in sync.
 *
 * Everything here is signed with the issuer service account's RSA key. The
 * signing runs on WebCrypto rather than node:crypto so the route keeps working
 * unchanged if the app ever moves to the Cloudflare Workers build that already
 * sits scaffolded in the repo.
 */

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUER_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

/** A warm ink with a real hue, for a theme whose palette offers no colour. */
const FALLBACK_BACKGROUND = "#5b3a22";

/**
 * The band a pass colour has to sit in.
 *
 * The ceiling is legibility: white on a colour of relative luminance L gives a
 * contrast of 1.05 / (L + 0.05), so WCAG AA's 4.5 runs out at L = 0.183. 0.16
 * keeps a little margin (5.0:1) rather than sitting on the line.
 *
 * The floor keeps a card from reading as flat black, which is wrong on a
 * wedding pass whatever the design. It is deliberately low: a true black is
 * already excluded for having no hue, so this only has to catch a colour that
 * is saturated and yet still essentially unlit. A deep burgundy at 0.036 is a
 * colour, not a black, and is left exactly as the designer chose it.
 */
const MIN_LUMINANCE = 0.03;
const MAX_LUMINANCE = 0.16;

/**
 * How far apart a colour's channels must be before it counts as having a hue,
 * as an absolute 0-255 spread rather than HSL saturation.
 *
 * HSL saturation is useless here: it divides by lightness, so a near-black
 * like #14110d — channels seven steps apart, black to any eye — scores 0.21
 * and passes, while the whole point is to reject it. Twenty-four steps keeps
 * a deep burgundy (#2b0f14, spread 28) and drops both that near-black and a
 * cream page ground (#F5F1EA, spread 11).
 */
const MIN_CHROMA = 24;

/**
 * The six colour roles every theme exposes, BUILDER and LEGACY alike —
 * `ThemeConfig.palette` and `VariantPalette` are the same shape. `swatch` is
 * optional, set only where `accent` had to be tuned for legibility against the
 * art and no longer reads as the variant's own colour.
 */
export type WalletPalette = {
  bg: string;
  surface: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  swatch?: string;
};

type Hsl = { h: number; s: number; l: number };
type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, sRGB, per WCAG — 0 is black, 1 is white. */
function luminanceOf([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rn
      ? (gn - bn) / d + (gn < bn ? 6 : 0)
      : max === gn
        ? (bn - rn) / d + 2
        : (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function toHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Moves a colour into the readable band without touching its hue.
 *
 * A colour already inside the band is returned untouched, and one outside it
 * travels to the nearer edge rather than to some midpoint — the least change
 * that makes it work. A pale gold darkens just enough to become bronze; a
 * navy so deep it reads black lifts barely at all. Only HSL lightness moves,
 * so what comes back is always the same colour, never a different one.
 *
 * Luminance rises monotonically with lightness at fixed hue and saturation, so
 * twenty bisection steps land well inside a single 8-bit step.
 */
function intoReadableBand(rgb: Rgb): string {
  const l = luminanceOf(rgb);
  if (l >= MIN_LUMINANCE && l <= MAX_LUMINANCE) return toHex(rgb);

  const target = l < MIN_LUMINANCE ? MIN_LUMINANCE : MAX_LUMINANCE;
  const hsl = toHsl(rgb);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (luminanceOf(fromHsl({ ...hsl, l: mid })) < target) lo = mid;
    else hi = mid;
  }
  return toHex(fromHsl({ ...hsl, l: (lo + hi) / 2 }));
}

/**
 * The pass wears the colour of the design it came from.
 *
 * `swatch` leads because that is exactly what the field is for: it exists for
 * variants whose `accent` had to be tuned against the artwork and no longer
 * reads as the variant's own colour — gold on a navy seal, where navy is the
 * answer to "what colour is this design".
 *
 * `bg` comes next, which looks wrong until you notice it costs nothing on a
 * light design — a cream page ground has no hue and is skipped — while on a
 * dark one it is the whole identity. Burgundy Velvet is burgundy because its
 * ground is #2b0f14; its accent is the same gold half the catalogue uses, and
 * leading with accent turned it into yet another bronze card. Then `accent`,
 * then `fg`.
 *
 * A candidate with no hue is skipped rather than used. A colourless role —
 * Black Tie's white accent, Royal Palace's near-black ground — can only ever
 * resolve to grey, and a grey card, black above all, is the one thing a
 * wedding pass should not be. Royal Palace therefore takes its gold instead,
 * deepened to bronze, which is what that design actually is.
 *
 * Lightness is adjusted where it must be, hue never. An earlier version
 * refused to adjust at all and simply picked whichever role already fell in
 * range; that is precisely what produced the black cards, because a dark
 * theme's `bg` is black by definition. Keeping the hue and moving the
 * lightness is the better trade.
 */
export function passBackgroundColor(palette: WalletPalette | null): string {
  if (!palette) return FALLBACK_BACKGROUND;

  const candidates = [palette.swatch, palette.bg, palette.accent, palette.fg]
    .map((hex) => (hex ? parseHex(hex) : null))
    .filter((rgb): rgb is Rgb => rgb !== null);

  const coloured = candidates.find(
    (rgb) => Math.max(...rgb) - Math.min(...rgb) >= MIN_CHROMA,
  );
  if (coloured) return intoReadableBand(coloured);

  // Every role is grey. Rather than print a grey card, fall back to the warm
  // default — the one case where a colour that is not the theme's own beats
  // the theme's own.
  return FALLBACK_BACKGROUND;
}

type WalletConfig = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
  logoUri: string;
};

/**
 * Reads the issuer credentials, or null when they are not set.
 *
 * Null is a first-class answer, not an error: until the Google issuer account
 * is approved the whole feature is simply absent, and every caller here is
 * written to fall back to the page the guest already had rather than fail.
 */
function walletConfig(): WalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const clientEmail = process.env.GOOGLE_WALLET_SA_EMAIL?.trim();
  // Vercel stores the PEM with literal backslash-n, so unescape before use.
  const privateKey = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!issuerId || !clientEmail || !privateKey) return null;

  return {
    issuerId,
    clientEmail,
    privateKey,
    // Google fetches the logo from a public URL — it never accepts uploaded
    // bytes — so this has to be a real, reachable file on the live domain.
    logoUri: process.env.GOOGLE_WALLET_LOGO_URL?.trim() || `${getAppUrl()}/wallet-logo.png`,
  };
}

export function googleWalletConfigured(): boolean {
  return walletConfig() !== null;
}

// ---------------------------------------------------------------- signing --

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlText(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

/** PEM (PKCS#8) → the raw DER bytes WebCrypto's importKey wants. */
function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) der[i] = binary.charCodeAt(i);
  return der;
}

// Importing the key parses the DER every time, which is pure CPU on a hot
// path shared by every guest — so hold the imported key for the lifetime of
// the isolate. It is derived from an env var that cannot change under us.
let cachedKey: Promise<CryptoKey> | null = null;

function signingKey(privateKey: string): Promise<CryptoKey> {
  cachedKey ??= crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKey) as unknown as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

async function signJwt(claims: Record<string, unknown>, config: WalletConfig): Promise<string> {
  const head = base64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64urlText(JSON.stringify(claims));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await signingKey(config.privateKey),
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${base64url(signature)}`;
}

// ------------------------------------------------------------ access token --

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * A service-account access token for the wallet_object.issuer scope.
 *
 * Cached until a minute before it lapses: Google issues these for an hour, and
 * minting one costs a full round trip that would otherwise sit in front of
 * every single "add to wallet" tap.
 */
async function accessToken(config: WalletConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    {
      iss: config.clientEmail,
      scope: ISSUER_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    config,
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed (${response.status}): ${await response.text()}`);
  }

  const token = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1000 };
  return token.access_token;
}

async function walletFetch(path: string, config: WalletConfig, init?: RequestInit): Promise<Response> {
  return fetch(`${WALLET_API}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${await accessToken(config)}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Writes a class or object, whichever way round it has to be done.
 *
 * The API has no upsert, so this PUTs first and falls back to POST on 404.
 * That order matters: an event whose date or venue the host edited must land
 * on the existing pass rather than fail as a duplicate, and PUT-then-create is
 * the only sequence that gets both the first save and every later edit right.
 */
async function put(resource: string, id: string, body: unknown, config: WalletConfig): Promise<void> {
  const update = await walletFetch(`/${resource}/${encodeURIComponent(id)}`, config, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (update.ok) return;
  if (update.status !== 404) {
    throw new Error(`Google Wallet ${resource} update failed (${update.status}): ${await update.text()}`);
  }

  const create = await walletFetch(`/${resource}`, config, { method: "POST", body: JSON.stringify(body) });
  if (!create.ok) {
    throw new Error(`Google Wallet ${resource} create failed (${create.status}): ${await create.text()}`);
  }
}

// ------------------------------------------------------------------ passes --

/**
 * The event start as Google wants it: wall-clock time with an explicit offset.
 *
 * Riyadh has observed no daylight saving since 1990, so +03:00 is a constant
 * rather than a simplification — but it is written out here on purpose. A bare
 * UTC stamp would show a guest her 8pm wedding as 5pm on the lock screen.
 */
function riyadhIsoWithOffset(date: Date): string {
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+03:00`;
}

/** Google ids allow `A-Za-z0-9._-` only, and are always issuer-prefixed. */
function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "-");
}

export type WalletEvent = {
  id: string;
  name: string;
  eventDate: Date;
  locationName: string;
  regionName: string | null;
  mapUrl: string | null;
  /** The event's theme palette; null for a theme that exposes none. */
  palette: WalletPalette | null;
};

export type WalletGuest = {
  id: string;
  nameAr: string;
  allowedCount: number;
  qrToken: string;
};

/**
 * Creates (or refreshes) the pass for one guest and returns the link that
 * saves it to her Google Wallet.
 *
 * Both the class and the object are written on every tap. That is one extra
 * round trip, and it buys the guarantee that a pass always shows the event as
 * it stands right now — the host can move the venue an hour before the door
 * opens and the next tap is correct, with no backfill and no webhook.
 */
export async function googleWalletSaveUrl(event: WalletEvent, guest: WalletGuest): Promise<string | null> {
  const config = walletConfig();
  if (!config) return null;

  const classId = `${config.issuerId}.event-${safeId(event.id)}`;
  const objectId = `${config.issuerId}.guest-${safeId(guest.id)}`;
  const venue = event.regionName ? `${event.locationName} — ${event.regionName}` : event.locationName;

  await put(
    "eventTicketClass",
    classId,
    {
      id: classId,
      issuerName: "دعوتي",
      reviewStatus: "UNDER_REVIEW",
      hexBackgroundColor: passBackgroundColor(event.palette),
      eventName: { defaultValue: { language: "ar", value: event.name } },
      venue: {
        name: { defaultValue: { language: "ar", value: event.locationName } },
        address: { defaultValue: { language: "ar", value: venue } },
      },
      dateTime: { start: riyadhIsoWithOffset(event.eventDate) },
      logo: { sourceUri: { uri: config.logoUri } },
      ...(event.mapUrl ? { linksModuleData: { uris: [{ uri: event.mapUrl, description: "الموقع على الخريطة" }] } } : {}),
    },
    config,
  );

  await put(
    "eventTicketObject",
    objectId,
    {
      id: objectId,
      classId,
      state: "ACTIVE",
      ticketHolderName: guest.nameAr,
      // The scanner reads the opaque token and nothing else — the same value
      // the on-screen QR encodes, so a saved pass and an open page check in
      // through one identical path.
      barcode: { type: "QR_CODE", value: guest.qrToken },
      ...(guest.allowedCount > 1
        ? {
            textModulesData: [
              { header: "عدد الأفراد", body: String(guest.allowedCount), id: "party" },
            ],
          }
        : {}),
    },
    config,
  );

  // The save link is a separate, short-lived JWT that only names the object —
  // the pass content itself already lives on Google's side by now.
  const saveJwt = await signJwt(
    {
      iss: config.clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [getAppUrl()],
      payload: { eventTicketObjects: [{ id: objectId, classId }] },
    },
    config,
  );

  return `https://pay.google.com/gp/v/save/${saveJwt}`;
}

/**
 * Retires a guest's saved pass — for a withdrawn invitation, or a guest who
 * accepted and then apologised.
 *
 * The pass stays in her wallet, greyed out and unscannable, which is the
 * honest outcome: silently deleting a ticket someone is holding at the door
 * tells her nothing, while an expired one tells her to ask the host.
 */
export async function expireGoogleWalletPass(guestId: string): Promise<void> {
  const config = walletConfig();
  if (!config) return;

  const objectId = `${config.issuerId}.guest-${safeId(guestId)}`;
  const response = await walletFetch(`/eventTicketObject/${encodeURIComponent(objectId)}`, config, {
    method: "PATCH",
    body: JSON.stringify({ state: "EXPIRED" }),
  });

  // A guest who never saved the pass has no object, and that is not a failure.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Google Wallet expire failed (${response.status}): ${await response.text()}`);
  }
}
