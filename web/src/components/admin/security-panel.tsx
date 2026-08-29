"use client";

import { useActionState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password-rules";
import {
  setAdminPasswordAction,
  setTestPhoneBypassAction,
  type AdminSecurityState,
} from "@/lib/auth/admin-login-actions";

/**
 * The two switches an admin owns.
 *
 * The password is set HERE first, from inside a session that already exists,
 * and only afterwards does the public sign-in page stop accepting admins. Doing
 * it the other way round would leave nobody able to sign in at all.
 */
export function SecurityPanel({
  locale,
  dict,
  hasPassword,
  bypassEnabled,
}: {
  locale: Locale;
  dict: Dictionary;
  hasPassword: boolean;
  bypassEnabled: boolean;
}) {
  const a = dict.adminAuth;
  const bound = setAdminPasswordAction.bind(null, locale);
  const [state, submit, pending] = useActionState<AdminSecurityState, FormData>(bound, null);
  const [togglePending, startToggle] = useTransition();

  const errorText =
    state?.error === "mismatch"
      ? a.passwordMismatch
      : state?.error === "password_weak"
        ? a.passwordWeak
        : state?.error === "current_wrong"
          ? a.currentWrong
          : state?.error
            ? dict.common.error
            : null;

  const field =
    "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold text-fg">{a.securityPasswordTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{a.securityPasswordBody}</p>
        <p
          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${
            hasPassword ? "bg-success/10 text-success" : "bg-warning/15 text-fg"
          }`}
        >
          {hasPassword ? a.securityPasswordSet : a.securityPasswordNotSet}
        </p>

        <form action={submit} className="mt-4 flex max-w-sm flex-col gap-3">
          {/* Only meaningful once one exists — the first time, being signed in
              as the admin is itself the proof. */}
          {hasPassword && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg-muted">{a.currentPasswordLabel}</span>
              <input
                type="password"
                name="currentPassword"
                dir="ltr"
                autoComplete="current-password"
                required
                className={field}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{a.newPasswordLabel}</span>
            <input
              type="password"
              name="newPassword"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{a.confirmPasswordLabel}</span>
            <input
              type="password"
              name="confirmPassword"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={field}
            />
          </label>
          <span className="text-xs text-fg-muted">{a.passwordRule}</span>

          {errorText && <p className="text-sm text-danger">{errorText}</p>}
          {state?.saved && <p className="text-sm text-success">{a.saved}</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? dict.common.loading : a.savePassword}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-fg">{a.bypassTitle}</h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              bypassEnabled ? "bg-warning/15 text-fg" : "bg-success/10 text-success"
            }`}
          >
            {bypassEnabled ? a.bypassOn : a.bypassOff}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{a.bypassBody}</p>

        <button
          type="button"
          disabled={togglePending}
          onClick={() => startToggle(() => setTestPhoneBypassAction(locale, !bypassEnabled))}
          className={`mt-4 h-11 rounded-full px-6 text-sm font-medium transition-colors disabled:opacity-50 ${
            bypassEnabled
              ? "border border-danger/40 text-danger hover:bg-danger/10"
              : "border border-accent text-accent hover:bg-accent hover:text-accent-fg"
          }`}
        >
          {bypassEnabled ? a.bypassDisable : a.bypassEnable}
        </button>
      </section>
    </div>
  );
}
