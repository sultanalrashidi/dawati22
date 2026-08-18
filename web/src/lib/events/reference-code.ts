import { randomBytes } from "node:crypto";

// Excludes visually-ambiguous characters (0/O, 1/I/L) — meant to be read
// aloud or typed by hand at a venue door, not just displayed on screen.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferenceCode(length = 6): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
