import "server-only";
import QRCode from "qrcode";

/** Renders a QR code (as a data: URI) that encodes only the opaque qrToken — never PII. */
export async function renderQrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}
