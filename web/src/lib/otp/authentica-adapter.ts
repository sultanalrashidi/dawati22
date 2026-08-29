import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/security/tokens";
import { OtpDeliveryError, type OtpAdapter } from "@/lib/otp/adapter";

const BASE_URL = "https://api.authentica.sa/api/v2";

interface AuthenticaSendResponse {
  success?: boolean;
  message?: string;
  errors?: { message?: string }[];
}

interface AuthenticaVerifyResponse {
  status?: boolean;
  message?: string;
  errors?: { message?: string }[];
}

/** Whatever the API complained about, as one line worth logging. */
function reason(payload: { message?: string; errors?: { message?: string }[] }): string {
  const fromErrors = payload.errors?.map((e) => e.message).filter(Boolean).join("; ");
  return fromErrors || payload.message || "unknown error";
}

/**
 * Authentica generates and checks the code itself.
 *
 * This used to POST an `otp` field to `/send-otp` in the belief that a code of
 * our own could ride along. The v2 schema has no such field — `method`,
 * `phone`, `email`, `template_id` and nothing else — so every real send was
 * rejected, and had it been accepted instead of rejected the customer would
 * have received Authentica's code while this codebase checked its own, which
 * fails in a far quieter way.
 *
 * `template_id` picks the SMS wording from the Authentica dashboard. 1 is their
 * documented default; `AUTHENTICA_TEMPLATE_ID` overrides it for an account
 * whose approved template is a different number, without a deploy.
 */
export function createAuthenticaOtpAdapter(apiKey: string, templateId?: number): OtpAdapter {
  // `Number(undefined)` is NaN, which `??` does not catch — hence isFinite
  // rather than a chain of defaults that would quietly post NaN.
  const configured = Number(process.env.AUTHENTICA_TEMPLATE_ID);
  const template = templateId ?? (Number.isFinite(configured) ? configured : 1);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Authorization": apiKey,
  };

  return {
    ownsCode: true,

    async sendOtp(phone) {
      const response = await fetch(`${BASE_URL}/send-otp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          method: "sms",
          phone,
          template_id: template,
        }),
      });

      let payload: AuthenticaSendResponse;
      try {
        payload = (await response.json()) as AuthenticaSendResponse;
      } catch {
        throw new OtpDeliveryError(`Authentica returned a non-JSON response (${response.status})`);
      }

      if (!response.ok || payload.success !== true) {
        logger.error("otp.authentica.send_failed", {
          phone: maskPhone(phone),
          status: response.status,
          reason: reason(payload),
        });
        throw new OtpDeliveryError(reason(payload));
      }

      logger.info("otp.authentica.sent", { phone: maskPhone(phone) });
      // No devCode: the code exists only at Authentica and on the customer's
      // phone, which is the entire point of switching real delivery on.
      return {};
    },

    async verifyOtp(phone, code) {
      const response = await fetch(`${BASE_URL}/verify-otp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone, otp: code }),
      });

      let payload: AuthenticaVerifyResponse;
      try {
        payload = (await response.json()) as AuthenticaVerifyResponse;
      } catch {
        // A wrong code must read as "wrong", never as an outage: throwing here
        // would surface a mistyped digit as a system error.
        logger.error("otp.authentica.verify_unreadable", { status: response.status });
        return false;
      }

      if (!response.ok || payload.status !== true) {
        logger.info("otp.authentica.verify_rejected", {
          phone: maskPhone(phone),
          status: response.status,
          reason: reason(payload),
        });
        return false;
      }
      return true;
    },
  };
}
