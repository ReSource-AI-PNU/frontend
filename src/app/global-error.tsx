"use client";

import { SUPPORT_EMAIL } from "@/components/legal/contact";

/**
 * 루트 레이아웃까지 실패했을 때만 보인다. globals.css와 글꼴이 없을 수 있으므로 스타일을 이 파일 안에 둔다.
 * 테마는 저장된 설정(localStorage)을 읽을 수 없을 수 있어 OS 설정(prefers-color-scheme)을 따른다.
 */
const CSS = `
:root{--bg:#FFFFFF;--surface:#FFFFFF;--line:#E8E8EA;--ink:#0A0A0A;--ink2:#3F3F46;--muted:#66666E;--loss:#B5332A;--onink:#FFFFFF;--marker:#E6FF3D;color-scheme:light}
@media (prefers-color-scheme: dark){:root{--bg:#0A0A0A;--surface:#111111;--line:#262626;--ink:#FAFAFA;--ink2:#D4D4D8;--muted:#A1A1AA;--loss:#FF7266;--onink:#0A0A0A;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:"Wanted Sans Variable","Pretendard Variable","Apple SD Gothic Neo",system-ui,sans-serif;line-height:1.6;word-break:keep-all;-webkit-font-smoothing:antialiased}
.rs-ge-head{display:flex;align-items:center;gap:10px;height:60px;padding:0 24px;border-bottom:1px solid var(--line);font-weight:700;letter-spacing:-0.02em}
.rs-ge-mark{display:grid;place-items:center;width:26px;height:26px;border-radius:6px;background:var(--ink);color:var(--onink);font:600 12px ui-monospace,monospace}
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
        <title>오류가 생겼습니다 · Re:Source AI</title>
        <style>{CSS}</style>
        <header className="rs-ge-head">
          <span className="rs-ge-mark" aria-hidden="true">
            R:
          </span>
          Re:Source AI
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
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>(연락처 확정 전)로 알려 주세요.
          </p>
        </main>
      </body>
    </html>
  );
}
