import Image from "next/image";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/photos";

/** 화면 한쪽을 채우는 현장 사진. 글은 사진 아래쪽 어두운 자리에 올린다. */
export function PhotoPane({ photo, children, className = "" }: { photo: Photo; children?: ReactNode; className?: string }) {
  return (
    <aside className={`relative isolate overflow-hidden bg-[#0d1512] text-white ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill unoptimized sizes="(min-width: 1024px) 58vw, 100vw" className="-z-10 object-cover" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(9_14_12/0.92)_0%,rgb(9_14_12/0.45)_45%,rgb(9_14_12/0.15)_100%)]" />
      <div className="flex h-full flex-col justify-end p-10 xl:p-14">{children}</div>
      <p className="absolute top-4 right-5 text-[11px] text-white/85 [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">사진 {photo.by} · Unsplash</p>
    </aside>
  );
}
