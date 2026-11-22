/**
 * 홈 화면에 추가(PWA) 정보. 앱을 따로 만들지 않고 같은 웹을 휴대폰에 설치한다. 기록은 웹과 같은 서버·계정에 남는다.
 * 색은 DESIGN.md 토큰(bg)이고, 아이콘은 scripts/make-pwa-icons.mjs가 src/app/icon.svg에서 만든다.
 * 검사: node --test tests/pwa.test.ts
 */
import type { MetadataRoute } from "next";

/** DESIGN.md 토큰 bg(라이트). 시작 화면과 상단 막대 색 */
export const PWA_COLORS = { background: "#ffffff", theme: "#ffffff" } as const;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "BYPRO",
    short_name: "BYPRO",
    description: "폐플라스틱을 받아 줄 곳과 조건을, 근거를 확인하며 AI가 대신 찾아 드립니다.",
    lang: "ko",
    dir: "ltr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PWA_COLORS.background,
    theme_color: PWA_COLORS.theme,
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
