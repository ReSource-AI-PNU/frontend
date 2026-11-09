"use client";

import { MoonIcon, SunIcon } from "./icons";

/** 표시는 CSS(dark: 변형)로만 바꾸므로 서버·클라이언트 렌더 결과가 같다. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="화면 모드 전환"
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] text-ink transition-colors hover:border-ink [&_svg]:size-4"
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
      <span className="dark:hidden">어둡게</span>
      <span className="hidden dark:inline">밝게</span>
    </button>
  );
}
