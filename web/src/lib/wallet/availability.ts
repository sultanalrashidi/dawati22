import "server-only";
import { appleWalletConfigured } from "@/lib/wallet/apple";
import { googleWalletConfigured } from "@/lib/wallet/google";

/**
 * Whether this deployment can put a pass in at least one wallet.
 *
 * Marketing copy — the landing page's feature card, the «بباركود» tier's
 * feature list — asks this before it promises "add it to Apple or Google
 * Wallet". The signing material lives in the environment and is absent on a
 * fresh deployment or a preview, and a promise the environment cannot keep is
 * a support ticket. The guest page keeps choosing per device through
 * `walletTargetsFor`; this is only the yes/no the sales copy needs.
 */
export function walletPassesConfigured(): boolean {
  // `next dev` never has the signing material, and it is where the owner
  // reviews this copy. No customer sees a dev server, so the claim shows there
  // as production renders it. The guest page asks the per-wallet checks, not
  // this, so no button appears in dev that cannot issue a pass.
  if (process.env.NODE_ENV === "development") return true;
  return appleWalletConfigured() || googleWalletConfigured();
}
