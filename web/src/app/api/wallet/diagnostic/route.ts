import { NextResponse } from "next/server";
import { googleWalletConfigured } from "@/lib/wallet/google";
import { appleWalletConfigured } from "@/lib/wallet/apple";
import { walletTargetsFor } from "@/lib/wallet/platform";

/**
 * TEMPORARY — delete once wallet rollout is confirmed.
 *
 * Answers one question a deployment cannot otherwise be asked: did the wallet
 * credentials actually reach this build? Every value here is a boolean, a
 * length, or the caller's own User-Agent — no key material, no issuer
 * identifiers, nothing that is not already public or already the caller's.
 */
export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent");
  const apple = appleWalletConfigured();
  const google = googleWalletConfigured();

  return NextResponse.json({
    apple: { configured: apple, certPresent: Boolean(process.env.APPLE_WALLET_CERT_PEM), certLength: process.env.APPLE_WALLET_CERT_PEM?.length ?? 0, keyPresent: Boolean(process.env.APPLE_WALLET_KEY_PEM), keyLength: process.env.APPLE_WALLET_KEY_PEM?.length ?? 0 },
    google: { configured: google, issuerPresent: Boolean(process.env.GOOGLE_WALLET_ISSUER_ID) },
    you: { userAgent, buttonsYouWouldSee: walletTargetsFor(userAgent, { apple, google }) },
  });
}
