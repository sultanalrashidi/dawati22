import { randomBytes, randomInt, createHash } from "node:crypto";

/**
 * High-entropy, non-sequential, unguessable token for invitation links / QR
 * payloads / session identifiers. 32 bytes -> 43 char base64url string.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way hash used to store tokens/OTP codes at rest (never store raw values). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 6-digit numeric OTP, generated with a CSPRNG (not Math.random). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Masks all but the last 3 digits of a phone number, for safe logging. */
export function maskPhone(phone: string): string {
  if (phone.length <= 3) return "***";
  return `${"*".repeat(phone.length - 3)}${phone.slice(-3)}`;
}
