/**
 * The support channels the product exposes: a WhatsApp number and an email.
 * Kept in one place so a future number/address change (or a new channel)
 * touches this file, not every page — the legal pages, footer and support
 * links all read from here.
 */

/** E.164 without the leading `+` — the format wa.me links expect. */
const SUPPORT_WHATSAPP_NUMBER = "966509076741";

/** The support/enquiries inbox listed in the legal pages and support links. */
export const SUPPORT_EMAIL = "info@dawati.store";

/** The same number as a `tel:` target. */
export const SUPPORT_PHONE_E164 = `+${SUPPORT_WHATSAPP_NUMBER}`;

/**
 * ...and how it reads to a human: `966509076741` → `+966 50 907 6741`.
 * Derived rather than written out, so the displayed number can never drift
 * from the one the WhatsApp and tel: links actually dial.
 */
export const SUPPORT_PHONE_DISPLAY = (() => {
  const local = SUPPORT_WHATSAPP_NUMBER.replace(/^966/, "");
  return `+966 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
})();

export function supportWhatsAppUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
