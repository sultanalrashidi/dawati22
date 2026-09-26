"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { OTP_MAX_LENGTH, isSubmittableOtp } from "@/lib/otp/format";
import { toWesternDigits } from "@/lib/arabic";
import type { Locale } from "@/lib/i18n/locales";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password-rules";
import {
  completeAdminLoginAction,
  startAdminLoginAction,
} from "@/lib/auth/admin-login-actions";

/**
 * Sign-in for the private admin route.
 *
 * Two steps, always in this order: the password is checked before any code is
 * sent, so guessing the URL cannot ring the admin's phone or burn SMS credit.
 * A third step appears only for an account that has no password yet — one
 * enrolling with the single-use token an operator issued, typed into the
 * password field — and it will not let the sign-in finish without setting one.
 */
export function AdminLoginForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const a = dict.adminAuth;

  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function minutes(seconds?: number) {
    return String(Math.ceil((seconds ?? 60) / 60));
  }

  function submitCredentials() {
    setError(null);
    startTransition(async () => {
      const result = await startAdminLoginAction(phone, password);
      if (!result.ok) {
        setError(
          result.error === "locked"
            ? a.locked.replace("{minutes}", minutes(result.retryAfterSeconds))
            : result.error === "rate_limited"
              ? a.rateLimited.replace("{minutes}", minutes(result.retryAfterSeconds))
              : result.error === "delivery"
                ? a.delivery
                : a.invalid,
        );
        return;
      }
      setNeedsPassword(result.needsPassword);
      setDevCode(result.devCode ?? null);
      setStep("code");
    });
  }

  function submitCode() {
    setError(null);
    if (needsPassword && newPassword !== confirmPassword) {
      setError(a.passwordMismatch);
      return;
    }
    startTransition(async () => {
      const result = await completeAdminLoginAction(
        phone,
        code,
        needsPassword ? newPassword : null,
        // An enrolling account typed its enrollment token into the password
        // field; the server spends it together with the code.
        needsPassword ? password : null,
        locale,
      );
      if (!result.ok) {
        setError(
          result.error === "locked"
            ? a.locked.replace("{minutes}", minutes(result.retryAfterSeconds))
            : result.error === "password_required"
              ? a.passwordWeak
              : result.error === "invalid_code"
                ? a.invalidCode
                : a.invalid,
        );
        return;
      }
      router.push(result.redirectTo);
    });
  }

  const field =
    "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {step === "credentials" ? (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{a.phoneLabel}</span>
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{a.passwordLabel}</span>
            <input
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={isPending || phone.length < 9}
            onClick={submitCredentials}
            className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? dict.common.loading : a.continue}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-fg-muted">{a.codeSent}</p>
          {devCode && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg" dir="ltr">
              {dict.auth.devCodeNotice} <strong>{devCode}</strong>
            </p>
          )}

          {needsPassword && (
            <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <div>
                <p className="text-sm font-bold text-fg">{a.recoveryTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{a.recoveryBody}</p>
              </div>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{a.newPasswordLabel}</span>
                <input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{a.confirmPasswordLabel}</span>
                <input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={field}
                />
              </label>
              <span className="text-xs text-fg-muted">{a.passwordRule}</span>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{a.codeLabel}</span>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              maxLength={OTP_MAX_LENGTH}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(toWesternDigits(e.target.value).replace(/\D/g, ""))}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-center text-lg tracking-[0.5em] text-fg outline-none focus:border-accent"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={
              isPending ||
              !isSubmittableOtp(code) ||
              (needsPassword && newPassword.length < MIN_PASSWORD_LENGTH)
            }
            onClick={submitCode}
            className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? dict.common.loading : a.verify}
          </button>
        </>
      )}
    </div>
  );
}
