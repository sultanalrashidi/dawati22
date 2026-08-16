"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { addGateStaffToEvent, revokeGateStaffAssignment, GateStaffError } from "@/lib/gatestaff/service";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

export type GateStaffActionState = { error?: string } | null;

export async function addGateStaffAction(
  eventId: string,
  locale: string,
  _prev: GateStaffActionState,
  formData: FormData
): Promise<GateStaffActionState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const phone = String(formData.get("phone") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) return { error: "invalid_name" };

  try {
    await addGateStaffToEvent(eventId, user.id, { phone, name });
  } catch (err) {
    if (err instanceof GateStaffError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/${safeLocale}/events/${eventId}`);
  return null;
}

export async function revokeGateStaffAction(assignmentId: string, eventId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await revokeGateStaffAssignment(assignmentId, user.id);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
}
