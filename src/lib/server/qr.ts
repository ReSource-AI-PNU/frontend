import "server-only";
import QRCode from "qrcode";

/** 여권 주소. QR에는 절대 주소가 들어가야 휴대폰 카메라로 열린다 */
export function passportUrl(id: string) {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/passport/${id}`;
}

/** 흑백 QR SVG 문자열(오류 정정 M, 여백 1) */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
}
