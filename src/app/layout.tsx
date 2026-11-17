import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { RegisterServiceWorker } from "@/components/pwa/register";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// 대회장 네트워크와 무관하게 동작하도록 본문 글꼴은 저장소에 포함한다 (SIL OFL 1.1, fonts/OFL-Pretendard.txt)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Re:Source AI",
    template: "%s · Re:Source AI",
  },
  description:
    "공장에서 나오는 폐플라스틱을 등록하면, 에이전트가 처리 업체의 에이전트와 근거를 확인하며 조건을 맞춰 받아 줄 곳을 찾습니다.",
  // 홈 화면에 추가했을 때(아이폰). 안드로이드는 manifest.ts를 읽는다
  appleWebApp: { capable: true, title: "Re:Source AI", statusBarStyle: "default" },
};

/** 브라우저 상단 막대 색: DESIGN.md 토큰 bg(라이트 #FFFFFF, 다크 #111113) */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      data-theme="light"
      suppressHydrationWarning
      className={`${pretendard.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
