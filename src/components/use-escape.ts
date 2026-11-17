"use client";

import { useEffect, useRef } from "react";
import { createEscapeStack } from "@/lib/escape-stack";

/** 화면 전체에 하나. 키 듣기도 하나만 둔다 */
const stack = createEscapeStack();
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (stack.escape()) event.preventDefault();
  });
}

/**
 * 열려 있는 동안 Esc로 닫는다. 여러 패널이 겹치면 마지막에 연 것 하나만 닫는다(src/lib/escape-stack.ts).
 */
export function useEscape(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    listen();
    return stack.push(() => close.current());
  }, [open]);
}
