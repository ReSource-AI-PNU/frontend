"use client";

import { buttonClass } from "./ui/button";

export function PrintButton({ label = "라벨 인쇄" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      {label}
    </button>
  );
}
