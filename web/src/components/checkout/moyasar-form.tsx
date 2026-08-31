"use client";

import { useEffect, useRef, useState } from "react";
import type { MoyasarFormConfig } from "@/lib/payments/moyasar";

/**
 * The card form itself is Moyasar's, loaded from their CDN and rendered into
 * `.mysr-form`. That is deliberate: a card number that never touches our own
 * markup is a card number our servers can never be asked to have leaked, and it
 * is what keeps PCI compliance Moyasar's problem rather than ours.
 *
 * Pinned to an exact version. `latest` on a payment form means a silent change
 * to the one screen in the product that takes money, discovered by customers.
 */
const MPF_VERSION = "1.16.0";
const MPF_SCRIPT = `https://cdn.moyasar.com/mpf/${MPF_VERSION}/moyasar.js`;
const MPF_STYLES = `https://cdn.moyasar.com/mpf/${MPF_VERSION}/moyasar.css`;

interface MoyasarGlobal {
  init: (options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    Moyasar?: MoyasarGlobal;
  }
}

/** Resolves once their script has run, or rejects if it never arrives. */
function loadMoyasarScript(): Promise<MoyasarGlobal> {
  if (window.Moyasar) return Promise.resolve(window.Moyasar);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MPF_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");

    script.addEventListener("load", () => {
      if (window.Moyasar) resolve(window.Moyasar);
      else reject(new Error("Moyasar script loaded without exposing its global"));
    });
    script.addEventListener("error", () => reject(new Error("Moyasar script failed to load")));

    if (!existing) {
      script.src = MPF_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export function MoyasarForm({
  config,
  unavailableLabel,
}: {
  config: MoyasarFormConfig;
  /** Shown if their CDN is unreachable — otherwise the guest sees an empty box. */
  unavailableLabel: string;
}) {
  const initialized = useRef(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    // Their script replaces this element's contents; initialising twice stacks
    // two card forms. StrictMode re-runs effects in development, so the guard
    // is load-bearing there and free everywhere else.
    if (initialized.current) return;
    initialized.current = true;

    // Deliberately no cancel-on-cleanup flag. StrictMode tears the effect down
    // and runs it again on the SAME instance, so a flag set by that teardown is
    // still set when the script finally resolves — and the form silently never
    // initialises. The ref above is the only guard needed: a real unmount makes
    // a new instance with a fresh ref, and a state update on a dead component
    // is a no-op.
    loadMoyasarScript()
      .then((moyasar) => {
        moyasar.init({
          element: ".mysr-form",
          amount: config.amount,
          currency: config.currency,
          description: config.description,
          publishable_api_key: config.publishableApiKey,
          callback_url: config.callbackUrl,
          // mada, Visa and Mastercard all arrive through `creditcard`. Apple Pay
          // is listed first (so its button leads on a device that supports it)
          // ONLY when the server switched it on — its config must be complete
          // and its domain verified, or Moyasar's form throws and the card form
          // dies with it. On a non-Apple device the button simply never renders.
          methods: config.applePay ? ["applepay", "creditcard"] : ["creditcard"],
          // Moyasar reads Apple Pay settings from this nested block. Omitted
          // entirely when off — an empty/partial block is what breaks the form.
          ...(config.applePay
            ? {
                apple_pay: {
                  country: config.applePay.country,
                  label: config.applePay.label,
                  validate_merchant_url: config.applePay.validateMerchantUrl,
                },
              }
            : {}),
          // `confirmMoyasarPayment` refuses any payment whose metadata does not
          // name this order. Dropping this line does not weaken a check — it
          // breaks every payment.
          metadata: config.metadata,
        });
      })
      .catch(() => {
        setUnavailable(true);
      });
  }, [config]);

  return (
    <>
      {/* React hoists this into <head>; it must live outside .mysr-form, whose
          contents Moyasar overwrites. */}
      <link rel="stylesheet" href={MPF_STYLES} precedence="default" />
      {unavailable ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{unavailableLabel}</p>
      ) : (
        <div className="mysr-form" />
      )}
    </>
  );
}
