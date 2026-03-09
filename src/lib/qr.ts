import QRCode from "qrcode";

const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 2,
  width: 240,
};

export async function generateQrDataUrl(ticketId: string): Promise<string> {
  return QRCode.toDataURL(ticketId, QR_OPTIONS);
}

export async function generateQrPngBuffer(ticketId: string): Promise<Buffer> {
  return QRCode.toBuffer(ticketId, {
    ...QR_OPTIONS,
    type: "png",
  });
}
