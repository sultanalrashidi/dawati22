"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  setUserBlocked,
  setEventStatus,
  createPlan,
  updatePlan,
  setPlanStatus,
  type PlanInput,
} from "@/lib/admin/service";
import { Role, EventStatus } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

export async function toggleUserBlockedAction(userId: string, locale: string, blocked: boolean) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setUserBlocked(userId, blocked);
  revalidatePath(`/${safeLocale}/admin/users`);
}

export async function cancelEventAction(eventId: string, locale: string) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setEventStatus(eventId, EventStatus.ARCHIVED);
  revalidatePath(`/${safeLocale}/admin/events`);
}

export type PlanFormState = { error?: string } | null;

function parsePlanForm(formData: FormData): PlanInput | null {
  const name = String(formData.get("name") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const invitationCount = Number(formData.get("invitationCount") ?? 0);
  const price = Number(formData.get("price") ?? 0);
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!name || !nameAr || invitationCount < 1 || invitationCount > 500 || price <= 0) return null;
  return { name, nameAr, invitationCount, price, sortOrder };
}

export async function createPlanAction(
  locale: string,
  _prev: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  await requireAdmin();
  const input = parsePlanForm(formData);
  if (!input) return { error: "invalid" };

  await createPlan(input);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/plans`);
  return null;
}

export async function updatePlanAction(
  planId: string,
  locale: string,
  _prev: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  await requireAdmin();
  const input = parsePlanForm(formData);
  if (!input) return { error: "invalid" };

  await updatePlan(planId, input);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/plans`);
  return null;
}

export async function setPlanStatusAction(
  planId: string,
  locale: string,
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED"
) {
  await requireAdmin();
  await setPlanStatus(planId, status);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/plans`);
}
