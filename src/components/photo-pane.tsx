import Image from "next/image";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/photos";

/** 화면 한쪽을 채우는 현장 사진. 글은 사진 아래쪽 어두운 자리에 짧게 올린다. */
export function PhotoPane({ photo, children, className = "" }: { photo: Photo; children?: ReactNode; className?: string }) {
  return (
    <aside className={`p-3 ${className}`}>
      <div className="relative isolate flex h-full flex-col justify-end overflow-hidden rounded-3xl bg-photo p-8 text-white xl:p-10">
        <Image src={photo.src} alt={photo.alt} fill unoptimized sizes="(min-width: 1024px) 55vw, 100vw" className="-z-10 object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(8_10_12/0.82)_0%,rgb(8_10_12/0.1)_55%)]" />
        {children}
      </div>
    </aside>
  );
}
