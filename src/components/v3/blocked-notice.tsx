"use client";

import { Button } from "@/components/ui/button";
import { blockCodeLabel, blockNotice } from "@/lib/v3/format";

/**
 * 막힌 승인의 사유와 푸는 방법. 사유는 approvals[].blockedCodes(코드 배열)로 읽고 문장(blockedReason)은 뜯어 읽지 않는다.
 *  - VENDOR_TERMS_CHANGED: 다시 실행하면 같은 대화를 새 조건으로 이어 간다(실행은 배출 기업만 한다).
 *  - STREAM_CHANGED, EVIDENCE_CHANGED: 자료가 바뀐 것이므로 새 진단이 필요하다.
 * 코드가 하나도 없으면(이 화면이 메시지의 검증 실패를 보고 막은 경우) 받은 문장을 그대로 적는다.
 */
export function BlockedNotice({
  codes,
  reason,
  canRerun,
  busy,
  onRerun,
  vendorName,
}: {
  codes: string[];
  reason: string | null;
  /** 배출 기업 관점이고 백엔드에 연결돼 있을 때만 다시 실행할 수 있다 */
  canRerun: boolean;
  busy: boolean;
  onRerun: () => void;
  vendorName?: string;
}) {
  const notice = blockNotice(codes);
  if (!notice) {
    return reason ? (
      <div role="alert" className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">
        <p className="font-semibold">승인할 수 없습니다: {reason}</p>
      </div>
    ) : null;
  }
  return (
    <div role="alert" className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">
      <p className="font-semibold">
        {vendorName ? `${vendorName} · ` : ""}
        {notice.headline}
      </p>
      <ul className="mt-1 space-y-0.5 text-[13px]">
        {codes.map((code) => (
          <li key={code}>
            {blockCodeLabel(code)} <span className="font-mono text-[12px]">{code}</span>
          </li>
        ))}
      </ul>
      {notice.action === "rerun" ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {canRerun ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onRerun}>
              {busy ? "실행 중" : "다시 실행"}
            </Button>
          ) : null}
          <span className="text-[13px]">
            {canRerun
              ? "같은 대화에서 회사 측이 조건을 다시 묻고 업체 측이 지금 조건으로 답합니다. 앞서 한 승인은 지워졌고, 재합의 뒤 양쪽이 다시 승인합니다."
              : "배출 기업 담당자가 다시 실행하면 같은 대화를 새 조건으로 이어 갑니다. 앞서 한 승인은 지워졌습니다."}
          </span>
        </div>
      ) : (
        <p className="mt-1 text-[13px]">
          앞서 한 승인은 양쪽 모두 지워졌습니다. 자료를 되돌리면 승인이 풀리고, 일부러 고친 것이라면 진단·연결 화면에서
          고친 자료로 새 진단을 시작하세요.
        </p>
      )}
    </div>
  );
}
