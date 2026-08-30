import "server-only";
import { prisma } from "@/lib/db/client";
import {
  DEFAULT_TYPOGRAPHY_PRESET,
  parseTypographyPreset,
  type TypographyPreset,
} from "@/lib/themes/typography-preset";

/**
 * Operational switches, stored in the database so the admin can flip them.
 *
 * They are deliberately NOT environment variables. The owner does not edit the
 * Vercel dashboard, and a switch that can only be thrown by someone who does is
 * a switch that never gets thrown — least of all in the hurry that is the only
 * reason it exists.
 */

export const SETTING_KEYS = {
  /** Whether the two test numbers may sign in with an on-screen code. */
  testPhoneBypass: "auth.test_phone_bypass",
  /** The house typeface new designs start from. */
  typographyPreset: "themes.typography_preset",
} as const;

/**
 * The numbers that skip the SMS and show their code on screen instead.
 *
 * Ordinary CUSTOMER accounts, never admin: the whole point of the private admin
 * route is that reaching the panel takes a real phone, and a bypass that also
 * covered the admin would hand that back.
 */
export const TEST_BYPASS_PHONES = ["+966500000004", "+966500000006"] as const;

export function isTestBypassPhone(phone: string): boolean {
  return (TEST_BYPASS_PHONES as readonly string[]).includes(phone);
}

async function readFlag(key: string): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  // Absent means off. Every switch here weakens something, so the value that
  // takes an explicit act to reach is the one that opens the door, never the
  // one that closes it.
  return row?.value === "on";
}

async function writeFlag(key: string, enabled: boolean): Promise<void> {
  const value = enabled ? "on" : "off";
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export function isTestPhoneBypassEnabled(): Promise<boolean> {
  return readFlag(SETTING_KEYS.testPhoneBypass);
}

export function setTestPhoneBypassEnabled(enabled: boolean): Promise<void> {
  return writeFlag(SETTING_KEYS.testPhoneBypass, enabled);
}

/**
 * The house typeface. Stored as JSON in the same key/value table: it is a
 * setting an admin changes, not data, and it should cost a row rather than a
 * migration.
 */
export async function getTypographyPreset(): Promise<TypographyPreset> {
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_KEYS.typographyPreset },
  });
  // Unset reads as the builder's own default, so a design created before any
  // admin touched this is still created from something sensible.
  return row ? parseTypographyPreset(row.value) : DEFAULT_TYPOGRAPHY_PRESET;
}

export async function setTypographyPreset(preset: TypographyPreset): Promise<void> {
  const value = JSON.stringify(preset);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS.typographyPreset },
    create: { key: SETTING_KEYS.typographyPreset, value },
    update: { value },
  });
}
