import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
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
    "공장에서 나오는 폐플라스틱을 등록하면, 에이전트가 처리 업체의 에이전트와 근거를 확인하며 조건을 맞춰 받아 줄 곳을 찾습니다.",
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
