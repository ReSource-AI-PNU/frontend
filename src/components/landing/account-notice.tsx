"use client";

import { useSearchParams } from "next/navigation";

/** 계정을 지우고 첫 화면으로 왔을 때(?account=deleted) 머리 아래에 조용히 한 줄 보인다. */
export function AccountNotice() {
  const params = useSearchParams();
  if (params.get("account") !== "deleted") return null;
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pt-4 lg:px-8">
      <p role="status" className="rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2">
        계정을 지웠습니다. 그동안 이용해 주셔서 감사합니다. 다시 쓰시려면 언제든 새로 가입할 수 있습니다.
      </p>
    </div>
  );
}
