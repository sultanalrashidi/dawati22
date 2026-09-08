import "server-only";
import forge from "node-forge";
import { APPLE_WWDR_G4_PEM } from "@/lib/wallet/apple-wwdr";
import { PASS_IMAGES } from "@/lib/wallet/apple-images";
import type { WalletEvent, WalletGuest, WalletPalette } from "@/lib/wallet/google";

/**
 * Apple Wallet — the same entry pass, as a signed .pkpass bundle.
 *
 * Nothing is served from Apple: a pass is a zip we build and sign ourselves,
 * holding pass.json, its images, a manifest of SHA-1 digests, and a detached
 * PKCS#7 signature over that manifest. Safari on an iPhone opens the file
 * straight into Wallet.
 *
 * The barcode carries the same `qrToken` the door scanner already reads, so an
 * Apple pass, a Google pass and an open web page are one guest with one code —
 * the gate never learns which she used.
 */

/**
 * Apple lets us set the text colour as well as the background, which Google
 * does not — so the pass wears the design exactly as drawn, with none of the
 * lightening the Google card needs to keep white text legible. This is the
 * whole reason an Apple pass can look like the invitation and a Google one
 * can only ever look like a ticket in the invitation's colour.
 */
const DEFAULT_BACKGROUND = "#F7F1E8";
const DEFAULT_INK = "#3A1E22";
const DEFAULT_LABEL = "#9A8272";

/** X.520 `userId` — where Apple writes the pass type identifier. */
const UID_OID = "0.9.2342.19200300.100.1.1";

type AppleConfig = { certPem: string; keyPem: string; passTypeId: string; teamId: string };

/** `rgb(r,g,b)` — the only colour syntax pass.json accepts. */
function toRgbString(hex: string, fallback: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  const n = parseInt(m ? m[1] : fallback.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * Reads the signing material, or null when it is not configured.
 *
 * The pass type and team identifiers are read out of the certificate rather
 * than configured beside it. They have to match it exactly — a single wrong
 * character and the iPhone rejects the pass with no message worth reading —
 * and a value that is derived cannot drift from the thing it must match.
 */
function appleConfig(): AppleConfig | null {
  const certPem = process.env.APPLE_WALLET_CERT_PEM?.replace(/\\n/g, "\n").trim();
  const keyPem = process.env.APPLE_WALLET_KEY_PEM?.replace(/\\n/g, "\n").trim();
  if (!certPem || !keyPem) return null;

  const cert = forge.pki.certificateFromPem(certPem);
  // Apple puts the pass type identifier in the subject's UID and the team id
  // in its OU. node-forge has no short name for UID, so it has to be asked for
  // by raw OID — `getField({ shortName: "UID" })` silently returns nothing,
  // which would have disabled the whole feature in production without a word.
  const passTypeId =
    cert.subject.getField({ type: UID_OID })?.value ??
    // Belt and braces: the CN carries the same value behind a fixed prefix.
    cert.subject.getField({ shortName: "CN" })?.value?.replace(/^Pass Type ID:\s*/, "");
  const teamId = cert.subject.getField({ shortName: "OU" })?.value;
  if (!passTypeId || !teamId) return null;

  return { certPem, keyPem, passTypeId, teamId };
}

export function appleWalletConfigured(): boolean {
  try {
    return appleConfig() !== null;
  } catch {
    // A malformed certificate should hide the button, not break the page.
    return false;
  }
}

/**
 * Riyadh wall-clock with an explicit offset, exactly as the Google pass does.
 * Saudi Arabia has kept +03:00 with no daylight saving since 1990, but writing
 * it out is what stops an 8pm wedding showing as 5pm on the lock screen.
 */
function riyadhIso(date: Date): string {
  return `${new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 19)}+03:00`;
}

function buildPassJson(
  config: AppleConfig,
  event: WalletEvent,
  guest: WalletGuest,
  palette: WalletPalette | null,
): string {
  const venue = event.regionName ? `${event.locationName} — ${event.regionName}` : event.locationName;

  return JSON.stringify({
    formatVersion: 1,
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
    serialNumber: guest.id,
    organizationName: "دعوتي",
    description: `دعوة ${guest.nameAr} — ${event.name}`,
    logoText: "دعوتي",
    backgroundColor: toRgbString(palette?.bg ?? "", DEFAULT_BACKGROUND),
    foregroundColor: toRgbString(palette?.fg ?? "", DEFAULT_INK),
    labelColor: toRgbString(palette?.fgMuted ?? "", DEFAULT_LABEL),
    // Surfaces the pass on the lock screen as the wedding starts, which is the
    // single thing a saved pass does that an open web page cannot.
    relevantDate: riyadhIso(event.eventDate),
    eventTicket: {
      primaryFields: [{ key: "event", label: "المناسبة", value: event.name }],
      secondaryFields: [
        { key: "holder", label: "حاملة التذكرة", value: guest.nameAr },
        { key: "date", label: "التاريخ", value: riyadhIso(event.eventDate), dateStyle: "PKDateStyleMedium", timeStyle: "PKDateStyleShort" },
      ],
      auxiliaryFields: [
        { key: "venue", label: "المكان", value: venue },
        ...(guest.allowedCount > 1
          ? [{ key: "party", label: "عدد الأفراد", value: String(guest.allowedCount) }]
          : []),
      ],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: guest.qrToken, messageEncoding: "iso-8859-1" }],
  });
}

// ---------------------------------------------------------------- signing --

/**
 * A detached PKCS#7 signature over the manifest — the one thing here WebCrypto
 * cannot do, which is why node-forge is a dependency at all. Apple verifies
 * this against the embedded chain, so the WWDR intermediate has to travel with
 * our own certificate.
 */
function signManifest(manifest: string, config: AppleConfig): Uint8Array {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest, "utf8");
  p7.addCertificate(forge.pki.certificateFromPem(config.certPem));
  p7.addCertificate(forge.pki.certificateFromPem(APPLE_WWDR_G4_PEM));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(config.keyPem),
    certificate: forge.pki.certificateFromPem(config.certPem),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime },
    ],
  });
  // Detached: the manifest itself is already in the bundle, so the signature
  // carries only the signature.
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const out = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i += 1) out[i] = der.charCodeAt(i);
  return out;
}

// -------------------------------------------------------------------- zip --

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * A minimal store-only zip.
 *
 * A .pkpass is an ordinary zip and Apple does not care whether its entries are
 * compressed, so writing the stored form directly costs about eighty lines and
 * saves pulling a zip library into the bundle for one call. Every entry is
 * ASCII-named and small; there is no need for zip64, unicode flags or data
 * descriptors, and leaving them out is what keeps this short enough to read.
 */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // stored
    local.setUint32(10, 0, true); // mtime/mdate — a fixed epoch keeps builds byte-identical
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    const localEntry = new Uint8Array(30 + name.length + file.data.length);
    localEntry.set(new Uint8Array(local.buffer), 0);
    localEntry.set(name, 30);
    localEntry.set(file.data, 30 + name.length);
    locals.push(localEntry);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0, true);
    central.setUint16(10, 0, true);
    central.setUint32(12, 0, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, file.data.length, true);
    central.setUint32(24, file.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);

    const centralEntry = new Uint8Array(46 + name.length);
    centralEntry.set(new Uint8Array(central.buffer), 0);
    centralEntry.set(name, 46);
    centrals.push(centralEntry);

    offset += localEntry.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...locals, ...centrals, new Uint8Array(end.buffer)]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

// ------------------------------------------------------------------ build --

function sha1Hex(bytes: Uint8Array): string {
  const md = forge.md.sha1.create();
  md.update(String.fromCharCode(...bytes));
  return md.digest().toHex();
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Builds the signed .pkpass for one guest, or null when Apple is not
 * configured — the same contract as the Google side, so the caller treats an
 * unconfigured wallet as an absent feature rather than an error.
 */
export function appleWalletPass(
  event: WalletEvent,
  guest: WalletGuest,
  palette: WalletPalette | null,
): Uint8Array | null {
  const config = appleConfig();
  if (!config) return null;

  const encoder = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [
    { name: "pass.json", data: encoder.encode(buildPassJson(config, event, guest, palette)) },
    ...Object.entries(PASS_IMAGES).map(([name, b64]) => ({ name, data: decodeBase64(b64) })),
  ];

  // The manifest is what the signature actually covers: change any file and
  // its digest changes, the signature stops matching, and the pass is refused.
  const manifest = JSON.stringify(
    Object.fromEntries(files.map((file) => [file.name, sha1Hex(file.data)])),
  );

  return zip([
    ...files,
    { name: "manifest.json", data: encoder.encode(manifest) },
    { name: "signature", data: signManifest(manifest, config) },
  ]);
}
