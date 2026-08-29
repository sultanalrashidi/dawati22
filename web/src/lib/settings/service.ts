import "server-only";
import { prisma } from "@/lib/db/client";

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
