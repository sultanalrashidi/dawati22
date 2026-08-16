import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/security/tokens";
import { OtpDeliveryError, type OtpAdapter } from "@/lib/otp/adapter";

const BASE_URL = "https://api.authentica.sa/api/v2";

interface AuthenticaSendResponse {
  success: boolean;
  message?: string;
}

export function createAuthenticaOtpAdapter(apiKey: string, templateId = 1): OtpAdapter {
  return {
    async sendOtp(phone, code) {
      const response = await fetch(`${BASE_URL}/send-otp`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Authorization": apiKey,
        },
        body: JSON.stringify({
          method: "sms",
          phone,
          otp: code,
          template_id: templateId,
        }),
      });

      let payload: AuthenticaSendResponse;
      try {
        payload = (await response.json()) as AuthenticaSendResponse;
      } catch {
        throw new OtpDeliveryError("Authentica returned a non-JSON response");
      }

      if (!response.ok || !payload.success) {
        logger.error("otp.authentica.send_failed", {
          phone: maskPhone(phone),
          status: response.status,
          message: payload.message,
        });
        throw new OtpDeliveryError(payload.message ?? "Failed to deliver OTP via Authentica");
      }

      logger.info("otp.authentica.sent", { phone: maskPhone(phone) });
      return {};
    },
  };
}
