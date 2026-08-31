/**
 * The support channels the product exposes: a WhatsApp number and an email.
 * Kept in one place so a future number/address change (or a new channel)
 * touches this file, not every page — the legal pages, footer and support
 * links all read from here.
 */

/** E.164 without the leading `+` — the format wa.me links expect. */
const SUPPORT_WHATSAPP_NUMBER = "966509076741";

/**
 * The display form of the WhatsApp number, shown verbatim in the legal pages
 * where a customer (or a Moyasar reviewer) reads the contact details.
 */
export const SUPPORT_WHATSAPP_DISPLAY = "+966 50 907 6741";

/** The support/enquiries inbox listed in the legal pages and support links. */
export const SUPPORT_EMAIL = "info@dawati.store";

export function supportWhatsAppUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
