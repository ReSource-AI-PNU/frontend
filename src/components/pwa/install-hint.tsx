"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";

const SEEN = "rsai-install-hint";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** 휴대폰 브라우저에서 처음 한 번만 보이는지. 이미 설치해 열었거나 보인 적이 있으면 보이지 않는다 */
function eligible(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  const phone = window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches;
  const installed =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let seen = true;
  try {
    seen = window.localStorage.getItem(SEEN) !== null;
  } catch {
    // 저장소를 쓸 수 없으면 보이지 않는다(매번 나타나지 않게)
  }
  return phone && !installed && !seen;
}

/**
 * "홈 화면에 추가" 안내. 휴대폰에서 처음 한 번만 조용한 띠로 보인다. 안드로이드 크롬이 설치를 허락하면 "추가" 단추로
 * 바로 설치하고, 아이폰은 공유 단추로 추가하는 법을 한 줄로 적는다. 설치해도 기록은 웹과 같은 계정에 남는다.
 */
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const timer = window.setTimeout(() => {
      if (!eligible()) return;
      try {
        window.localStorage.setItem(SEEN, new Date().toISOString());
      } catch {
        return;
      }
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
      setShow(true);
    }, 0);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  if (!show) return null;
  return (
    <div role="note" className="flex items-start gap-3 border-b border-line bg-ground px-5 py-3 text-sm text-ink-2 [animation:rs-rise_240ms_var(--ease-out)_both]">
      <p className="min-w-0 flex-1">
        <span className="font-medium text-ink">홈 화면에 추가</span>하면 앱처럼 바로 열 수 있습니다. 기록은 웹과 같은 계정에 남습니다.
        {!prompt && ios ? <span className="mt-0.5 block text-[13px] text-muted">아래 공유 단추를 누르고 ‘홈 화면에 추가’를 고르세요.</span> : null}
      </p>
      {prompt ? (
        <button
          type="button"
          onClick={() => {
            void prompt.prompt().finally(() => setShow(false));
          }}
          className="min-h-11 shrink-0 rounded-md px-2 font-semibold text-ink underline underline-offset-4"
        >
          추가
        </button>
      ) : null}
      <button type="button" aria-label="안내 닫기" onClick={() => setShow(false)} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
        <CloseIcon />
      </button>
    </div>
  );
}
