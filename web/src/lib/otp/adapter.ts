/**
 * We always generate and verify the OTP code ourselves (locally hashed,
 * rate-limited, expiring) — the adapter's only job is to deliver a code we
 * already generated. Authentica's `send-otp` accepts a custom `otp` field
 * for exactly this, so both adapters share one verification code path.
 */
export interface OtpAdapter {
  /** Delivers `code` to `phone` (already E.164). Returns a dev-only echo when running mocked. */
  sendOtp(phone: string, code: string): Promise<{ devCode?: string }>;
}

export class OtpDeliveryError extends Error {}
