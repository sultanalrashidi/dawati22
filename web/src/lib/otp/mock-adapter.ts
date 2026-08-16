import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/security/tokens";
import type { OtpAdapter } from "@/lib/otp/adapter";

/** Local adapter used whenever AUTHENTICA_API_KEY is not configured. Never sends a real SMS. */
export const mockOtpAdapter: OtpAdapter = {
  async sendOtp(phone, code) {
    logger.info("otp.mock.sent", { phone: maskPhone(phone) });
    // The code is deliberately not logged. It's only returned here so the
    // dev-mode UI can surface it directly to the person testing the flow.
    return { devCode: code };
  },
};
