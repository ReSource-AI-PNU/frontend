import "server-only";
import { connection } from "next/server";

/**
 * 백엔드가 아직 열지 않은 관리 기능. 서버 액션이 404·405(업무 코드 없음)를 받으면 여기에 적고, 화면은 그 단추를 숨긴다.
 * 백엔드를 새로 배포하면 다시 나타나도록 10분 뒤에 잊는다. 서버 인스턴스마다 따로 기억한다(한 번 실패하면 그 인스턴스에서 숨김).
 */
export type Capability = "orgEdit" | "memberRemove" | "ownerGrant" | "passwordChange" | "accountDelete";

const FORGET_AFTER_MS = 10 * 60_000;
const hiddenUntil = new Map<Capability, number>();

export function markUnsupported(capability: Capability): void {
  hiddenUntil.set(capability, Date.now() + FORGET_AFTER_MS);
}

function supportedNow(capability: Capability, now: number): boolean {
  const until = hiddenUntil.get(capability);
  if (until === undefined) return true;
  if (now >= until) {
    hiddenUntil.delete(capability);
    return true;
  }
  return false;
}

/** 화면이 그릴 기능. 요청 때만 읽는다(미리 그리기에서는 모두 보인다고 보지 않는다). */
export async function capabilities(): Promise<Record<Capability, boolean>> {
  await connection();
  const now = Date.now();
  return {
    orgEdit: supportedNow("orgEdit", now),
    memberRemove: supportedNow("memberRemove", now),
    ownerGrant: supportedNow("ownerGrant", now),
    passwordChange: supportedNow("passwordChange", now),
    accountDelete: supportedNow("accountDelete", now),
  };
}
