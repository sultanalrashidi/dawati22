"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { OTP_MAX_LENGTH, isSubmittableOtp } from "@/lib/otp/format";
import { toWesternDigits } from "@/lib/arabic";
import type { Locale } from "@/lib/i18n/locales";
import {
  PHONE_COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  getPhoneCountry,
  normalizePhone,
} from "@/lib/security/phone";
import {
  requestLoginOtpAction,
  submitOtpCodeAction,
  completeSignupAction,
  type PendingOrder,
} from "@/lib/auth/login-actions";

type Step = "phone" | "otp" | "name";

const RESEND_COOLDOWN_S = 30;

export function LoginForm({
  locale,
  dict,
  pendingOrder = null,
}: {
  locale: Locale;
  dict: Dictionary;
  /**
   * A tier the visitor chose on the pricing page before signing in. When it is
   * here, sign-in ends at that order's checkout instead of the events list —
   * otherwise they would land back on the pricing page and pick twice.
   */
  pendingOrder?: PendingOrder | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = getPhoneCountry(country) ?? PHONE_COUNTRIES[0];
  // The button is live exactly when the server would accept the number, so the
  // client's idea of "valid" and the action's never drift apart.
  const normalized = normalizePhone(phone, country);
  const groups = useMemo(
    () => ({
      gulf: PHONE_COUNTRIES.filter((c) => c.region === "gulf"),
      arab: PHONE_COUNTRIES.filter((c) => c.region === "arab"),
    }),
    [],
  );
  const countryName = (iso: string) => {
    const c = getPhoneCountry(iso);
    if (!c) return "";
    return locale === "ar" ? c.nameAr : c.nameEn;
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  function sendCode() {
    setError(null);
    startTransition(async () => {
      const result = await requestLoginOtpAction(phone, country);
      if (!result.ok) {
        if (result.error === "rate_limited") {
          setError(dict.auth.tooManyAttempts);
          setCooldown(result.retryAfterSeconds ?? RESEND_COOLDOWN_S);
        } else if (result.error === "delivery") {
          setError(dict.auth.deliveryFailed);
        } else {
          setError(dict.auth.invalidPhone);
        }
        return;
      }
      setSentTo(result.phone);
      setDevCode(result.devCode ?? null);
      setCooldown(RESEND_COOLDOWN_S);
      setStep("otp");
    });
  }

  function verifyCode() {
    setError(null);
    startTransition(async () => {
      const result = await submitOtpCodeAction(phone, country, code, locale, pendingOrder);
      if (!result.ok) {
        const message =
          result.error === "invalid_code"
            ? dict.auth.invalidCode
            : result.error === "account_blocked"
              ? dict.auth.accountBlocked
              : dict.auth.invalidPhone;
        setError(message);
        return;
      }
      if (result.needsName) {
        setOtpId(result.otpId);
        setStep("name");
        return;
      }
      router.push(result.redirectTo);
    });
  }

  function completeSignup() {
    setError(null);
    if (!otpId) return;
    startTransition(async () => {
      const result = await completeSignupAction(otpId, phone, country, name, locale, pendingOrder);
      if (!result.ok) {
        setError(result.error === "name_required" ? dict.common.requiredField : dict.auth.codeExpired);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {step === "phone" && (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{dict.auth.phoneLabel}</span>
            <div className="flex gap-2" dir="ltr">
              <select
                aria-label={dict.auth.countryLabel}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-11 max-w-[42%] shrink-0 rounded-lg border border-border bg-bg px-2 text-fg outline-none focus:border-accent"
              >
                <optgroup label={dict.auth.countryGroupGulf}>
                  {groups.gulf.map((c) => (
                    <option key={c.iso} value={c.iso}>
                      {c.flag} {countryName(c.iso)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={dict.auth.countryGroupArab}>
                  {groups.arab.map((c) => (
                    <option key={c.iso} value={c.iso}>
                      {c.flag} {countryName(c.iso)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-lg border border-border bg-bg focus-within:border-accent">
                <span className="select-none ps-3 pe-1 text-fg-muted">+{selected.dialCode}</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(toWesternDigits(e.target.value))}
                  placeholder={selected.example}
                  className="h-full min-w-0 flex-1 rounded-e-lg bg-transparent pe-3 text-fg outline-none"
                  autoFocus
                />
              </div>
            </div>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={isPending || !normalized || cooldown > 0}
            onClick={sendCode}
            className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? dict.common.loading : dict.auth.sendCode}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <p className="text-sm text-fg-muted">
            {dict.auth.otpSubtitle} <span dir="ltr">{sentTo || phone}</span>
          </p>
          {devCode && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg" dir="ltr">
              {dict.auth.devCodeNotice} <strong>{devCode}</strong>
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{dict.auth.otpLabel}</span>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              maxLength={OTP_MAX_LENGTH}
              value={code}
              onChange={(e) => setCode(toWesternDigits(e.target.value).replace(/\D/g, ""))}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-center text-lg tracking-[0.5em] text-fg outline-none focus:border-accent"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={isPending || !isSubmittableOtp(code)}
            onClick={verifyCode}
            className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? dict.common.loading : dict.auth.verify}
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || isPending}
            onClick={sendCode}
            className="text-sm text-fg-muted underline decoration-dotted disabled:opacity-50"
          >
            {cooldown > 0
              ? dict.auth.resendIn.replace("{seconds}", String(cooldown))
              : dict.auth.resendCode}
          </button>
        </>
      )}

      {step === "name" && (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">{dict.auth.nameLabel}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dict.auth.namePlaceholder}
              className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={isPending || name.trim().length < 2}
            onClick={completeSignup}
            className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? dict.common.loading : dict.common.continue}
          </button>
        </>
      )}
    </div>
  );
}
