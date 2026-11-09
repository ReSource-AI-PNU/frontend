import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// 대회장 네트워크와 무관하게 동작하도록 본문 글꼴은 저장소에 포함한다 (SIL OFL 1.1, fonts/OFL.txt)
const wantedSans = localFont({
  src: "./fonts/WantedSansVariable.woff2",
  variable: "--font-wanted",
  weight: "400 1000",
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
    "폐기물 사진 한 장으로 품목·오염도를 판정하고, 산업단지 묶음 수거와 처리 방식별 비용·탄소를 비교해 견적 요청서까지 만드는 에이전트.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      data-theme="light"
      suppressHydrationWarning
      className={`${wantedSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
