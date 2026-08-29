import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password hashing for the one password this product has: the admin's.
 *
 * scrypt from Node's own crypto rather than a bcrypt/argon2 dependency —
 * it is deliberately slow, memory-hard, and already here, and a native
 * addon for a single password would be a build-time liability for nothing.
 *
 * NOT interchangeable with `sha256Hex`. That one exists to make tokens and
 * PINs unreadable at rest; those are high-entropy or short-lived and rate
 * limited. A password a person chose needs the work factor, or a leaked
 * database is a leaked password.
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** Stored as `scrypt$<salt-hex>$<key-hex>`, so the format can change later without guessing. */
const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** False for a wrong password AND for a stored value this function did not write. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== PREFIX || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  // Constant time: a plain === leaks how much of the hash matched, one byte at
  // a time, to anyone who can measure the response.
  return timingSafeEqual(actual, expected);
}
