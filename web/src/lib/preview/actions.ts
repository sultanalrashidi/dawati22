"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { rotateSelfPreviewToken } from "@/lib/preview/self";

/**
 * A new test link, and the old one stops working.
 *
 * The only mutation the test invitation has — everything else about it is a
 * read. `requireUserOrThrow` here in the action itself, and the ownership
 * check again in the WHERE clause of the update, so a guessed event id
 * rotates nothing.
 */
export async function rotateTestInvitationAction(eventId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await rotateSelfPreviewToken(eventId, user.id);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
}
