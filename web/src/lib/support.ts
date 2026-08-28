/**
 * The one support channel the product currently has: a WhatsApp number, not a
 * form or a ticket system. Kept in one place so a future number change (or a
 * second channel) touches this file, not every page that links to support.
 */

/** E.164 without the leading `+` — the format wa.me links expect. */
const SUPPORT_WHATSAPP_NUMBER = "966509076741";

export function supportWhatsAppUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
