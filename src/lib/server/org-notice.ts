import "server-only";
import { cookies } from "next/headers";
import { encodeOrgNotice, ORG_NOTICE_COOKIE, ORG_NOTICE_MAX_AGE, parseOrgNotice, type OrgNotice } from "@/lib/auth/membership-sync";

/**
 * 회사에서 나왔거나 빠졌다는 안내를 다음 화면에 한 번 보인다(src/lib/auth/membership-sync.ts).
 * 쿠키는 서버 액션에서만 쓸 수 있으므로 적기는 서버 액션이, 지우기는 안내를 보인 화면(브라우저)이 한다.
 */
export async function rememberOrgNotice(notice: OrgNotice): Promise<void> {
  (await cookies()).set(ORG_NOTICE_COOKIE, encodeOrgNotice(notice), {
    path: "/",
    maxAge: ORG_NOTICE_MAX_AGE,
    sameSite: "lax",
    // 화면이 보인 뒤 지운다(document.cookie). 회사 이름만 담는다
    httpOnly: false,
  });
}

export async function readOrgNotice(): Promise<OrgNotice | null> {
  return parseOrgNotice((await cookies()).get(ORG_NOTICE_COOKIE)?.value);
}
