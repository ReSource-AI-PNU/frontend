import { createManualCSession } from "@/lib/server/c-questions/create-session";

export default function ManualStart() {
  return <div className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-12">
    <h1 className="text-h1 font-bold">PP 정보 직접 입력</h1>
    <p className="text-ink-2">사진이나 문서 없이 알고 있는 정보를 입력합니다. 모르는 항목은 질문에서 확인할 수 있습니다.</p>
    <p className="rounded-md bg-sunken p-4 text-sm">질문 종료는 사실 검증이나 자원화 적합성 확정이 아닙니다. 업체 전송이나 거래 확정은 수행하지 않습니다.</p>
    <form action={createManualCSession}><button className="rounded-md bg-ink px-5 py-3 font-semibold text-on-ink">직접 입력 시작</button></form>
  </div>;
}
