"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSession } from "@/lib/auth/session";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { OtpRateLimitError } from "@/lib/otp/service";
import {
  AdminLoginError,
  AdminLoginLockedError,
  completeAdminLogin,
  setAdminPassword,
  startAdminLogin,
} from "@/lib/auth/admin-login";
import { setTestPhoneBypassEnabled } from "@/lib/settings/service";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

export type AdminStartResult =
  | { ok: true; needsPassword: boolean; devCode?: string; phone: string }
  | { ok: false; error: "invalid" | "locked" | "rate_limited" | "delivery"; retryAfterSeconds?: number };

export async function startAdminLoginAction(
  phone: string,
  password: string,
): Promise<AdminStartResult> {
  try {
    const result = await startAdminLogin(phone, password);
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof AdminLoginLockedError) {
      return { ok: false, error: "locked", retryAfterSeconds: err.retryAfterSeconds };
    }
    if (err instanceof OtpRateLimitError) {
      return { ok: false, error: "rate_limited", retryAfterSeconds: err.retryAfterSeconds };
    }
    if (err instanceof AdminLoginError) {
      return { ok: false, error: err.message === "delivery" ? "delivery" : "invalid" };
    }
    throw err;
  }
}

export type AdminVerifyResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      error: "invalid" | "invalid_code" | "locked" | "password_required";
      retryAfterSeconds?: number;
    };

export async function completeAdminLoginAction(
  phone: string,
  code: string,
  newPassword: string | null,
  locale: string,
): Promise<AdminVerifyResult> {
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  try {
    const { userId } = await completeAdminLogin(phone, code, newPassword);
    const hdrs = await headers();
    await createSession(userId, {
      userAgent: hdrs.get("user-agent") ?? undefined,
      ip: hdrs.get("x-forwarded-for") ?? undefined,
    });
    return { ok: true, redirectTo: `/${safeLocale}/admin` };
  } catch (err) {
    if (err instanceof AdminLoginLockedError) {
      return { ok: false, error: "locked", retryAfterSeconds: err.retryAfterSeconds };
    }
    if (err instanceof AdminLoginError) {
      const known = ["invalid_code", "password_required"] as const;
      const error = (known as readonly string[]).includes(err.message)
        ? (err.message as "invalid_code" | "password_required")
        : "invalid";
      return { ok: false, error };
    }
    throw err;
  }
}

export type AdminSecurityState = { error?: string; saved?: boolean } | null;

export async function setAdminPasswordAction(
  locale: string,
  _prev: AdminSecurityState,
  formData: FormData,
): Promise<AdminSecurityState> {
  const user = await requireUserOrThrow([Role.ADMIN]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next !== confirm) return { error: "mismatch" };

  try {
    await setAdminPassword(user.id, current, next);
  } catch (err) {
    if (err instanceof AdminLoginError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/${safeLocale}/admin/security`);
  return { saved: true };
}

export async function setTestPhoneBypassAction(locale: string, enabled: boolean): Promise<void> {
  await requireUserOrThrow([Role.ADMIN]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setTestPhoneBypassEnabled(enabled);
  revalidatePath(`/${safeLocale}/admin/security`);
}
