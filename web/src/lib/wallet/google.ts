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

/** The card's ink — the rose-emboss pass art this ticket stands in for. */
const PASS_BACKGROUND = "#5b3a22";

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
      hexBackgroundColor: PASS_BACKGROUND,
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
