"use client";

import { SUPPORT_EMAIL } from "@/components/legal/contact";
import { particle } from "@/lib/josa";

/**
 * 루트 레이아웃까지 실패했을 때만 보인다. globals.css와 글꼴이 없을 수 있으므로 스타일을 이 파일 안에 둔다.
 * 테마는 저장된 설정(localStorage)을 읽을 수 없을 수 있어 OS 설정(prefers-color-scheme)을 따른다.
 */
const CSS = `
:root{--bg:#FFFFFF;--surface:#FFFFFF;--line:#E8E8EA;--ink:#0A0A0A;--ink2:#3F3F46;--muted:#66666E;--loss:#B5332A;--onink:#FFFFFF;--marker:#E6FF3D;color-scheme:light}
@media (prefers-color-scheme: dark){:root{--bg:#0A0A0A;--surface:#111111;--line:#262626;--ink:#FAFAFA;--ink2:#D4D4D8;--muted:#A1A1AA;--loss:#FF7266;--onink:#0A0A0A;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:"Pretendard Variable","Apple SD Gothic Neo",system-ui,sans-serif;line-height:1.6;word-break:keep-all;-webkit-font-smoothing:antialiased}
.rs-ge-head{display:flex;align-items:center;gap:10px;height:60px;padding:0 24px;border-bottom:1px solid var(--line);font-weight:700;letter-spacing:-0.02em}
.rs-ge-mark{height:15px;width:auto;flex:none}
.rs-ge-main{max-width:640px;margin:0 auto;padding:80px 24px}
.rs-ge-label{margin:0;color:var(--loss);font-size:13px;font-weight:600}
.rs-ge-main h1{margin:8px 0 12px;font-size:24px;line-height:1.3;letter-spacing:-0.025em}
.rs-ge-main p{margin:0 0 16px;color:var(--ink2)}
.rs-ge-code{display:inline-block;margin:0 0 20px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);font:500 14px ui-monospace,monospace;font-variant-numeric:tabular-nums;user-select:all}
.rs-ge-actions{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px}
.rs-ge-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:6px;border:1px solid transparent;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}
.rs-ge-primary{background:var(--ink);color:var(--onink)}
.rs-ge-secondary{background:var(--surface);color:var(--ink);border-color:var(--line)}
.rs-ge-btn:focus-visible{outline:2px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 5px var(--marker)}
.rs-ge-foot{padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
.rs-ge-foot a{color:var(--ink);font-weight:600}
`;

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <html lang="ko">
      <body>
        <title>오류가 생겼습니다 · BYPRO</title>
        <style>{CSS}</style>
        <header className="rs-ge-head">
          <svg className="rs-ge-mark" viewBox="0 0 623.01 100" role="img" aria-label="BYPRO">
            <path d="M0 98.31V1.69H79.44Q87.29 1.69 93.65 4.71Q100.01 7.73 103.71 13.07Q107.41 18.41 107.41 25.5Q107.41 31.82 105.15 36.32Q102.89 40.82 99.08 43.61Q95.27 46.4 90.62 47.8V48.36Q96.04 49.48 100.41 52.42Q104.77 55.35 107.31 60.23Q109.86 65.12 109.86 72.21Q109.86 80.52 105.85 86.34Q101.85 92.17 95.05 95.24Q88.26 98.31 79.9 98.31ZM28.62 77.94H70.35Q74.84 77.94 77.68 75.49Q80.52 73.04 80.52 67.98Q80.52 65.3 79.3 63.17Q78.07 61.03 75.7 59.85Q73.33 58.67 69.96 58.67H28.62ZM28.62 39.86H67.97Q71.24 39.86 73.48 38.68Q75.72 37.5 76.93 35.35Q78.15 33.2 78.15 30.29Q78.15 26.17 75.37 23.77Q72.59 21.37 68.35 21.37H28.62ZM161.87 98.31V59.78L114.11 1.69H147.93L176.23 37.82H177.4L205.9 1.69H238.23L190.49 59.78V98.31ZM251.14 98.31V1.69H325.72Q335.21 1.69 342.36 5.88Q349.51 10.07 353.49 17.47Q357.47 24.87 357.47 34.53Q357.47 44.28 353.42 51.78Q349.37 59.29 342.15 63.44Q334.94 67.59 325.46 67.59H279.76V98.31ZM279.76 46.38H317.5Q323.85 46.38 327.13 43.33Q330.41 40.28 330.41 34.66Q330.41 30.85 328.92 28.25Q327.44 25.64 324.58 24.27Q321.72 22.9 317.5 22.9H279.76ZM370.74 98.31V1.69H451.17Q461.73 1.69 468.65 6.02Q475.57 10.36 479.03 17.44Q482.49 24.53 482.49 32.9Q482.49 42.08 478.14 49.6Q473.79 57.12 465.05 61.49L484.8 98.31H452.52L436.49 66.17H399.36V98.31ZM399.36 45.03H441.83Q446.98 45.03 450.07 41.93Q453.16 38.83 453.16 33.7Q453.16 30.23 451.76 27.81Q450.37 25.39 447.85 24.14Q445.33 22.9 441.83 22.9H399.36ZM559.54 100Q540.1 100 525.85 94.05Q511.6 88.11 503.89 76.93Q496.18 65.76 496.18 50.03Q496.18 34.18 503.89 23Q511.6 11.82 525.85 5.91Q540.1 0 559.54 0Q579.23 0 593.41 5.91Q607.6 11.82 615.3 23Q623.01 34.18 623.01 50.03Q623.01 65.76 615.3 76.93Q607.6 88.11 593.41 94.05Q579.23 100 559.54 100ZM559.6 78.79Q567.17 78.79 573.4 76.94Q579.64 75.08 584.18 71.56Q588.71 68.03 591.16 62.94Q593.61 57.86 593.61 51.51V48.21Q593.61 41.89 591.16 36.86Q588.71 31.83 584.18 28.34Q579.64 24.85 573.4 23.03Q567.17 21.21 559.6 21.21Q552.03 21.21 545.79 23.03Q539.55 24.85 535.02 28.34Q530.49 31.83 528.07 36.86Q525.65 41.89 525.65 48.21V51.51Q525.65 57.86 528.07 62.94Q530.49 68.03 535.02 71.56Q539.55 75.08 545.79 76.94Q552.03 78.79 559.6 78.79Z" fill="currentColor" />
          </svg>
        </header>
        <main className="rs-ge-main" role="alert">
          <p className="rs-ge-label">서비스 오류</p>
          <h1>서비스를 불러오지 못했습니다</h1>
          <p>일시적인 문제일 수 있으니 다시 시도해 주세요. 저장을 마친 내용은 그대로 남아 있습니다.</p>
          {digest ? (
            <p>
              <span className="rs-ge-code" aria-label={`오류 코드 ${digest}`}>
                {digest}
              </span>
            </p>
          ) : null}
          <div className="rs-ge-actions">
            <button type="button" className="rs-ge-btn rs-ge-primary" onClick={() => retry()}>
              다시 시도
            </button>
            {/* 루트가 깨진 상태이므로 클라이언트 이동 대신 새로 불러온다 */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="rs-ge-btn rs-ge-secondary">
              홈으로 가기
            </a>
          </div>
          <p className="rs-ge-foot">
            계속 같은 화면이 나오면 {digest ? "위 오류 코드와 함께 " : ""}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>(연락처 확정 전){particle(SUPPORT_EMAIL, "으로/로")} 알려 주세요.
          </p>
        </main>
      </body>
    </html>
  );
}
