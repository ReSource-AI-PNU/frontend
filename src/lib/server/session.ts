import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";

export type CurrentUser = { id: string; name: string; email: string | null };

/**
 * 화면을 그리며 세션을 읽을 때는 auth() 대신 이것을 쓴다. 반드시 Suspense 경계 안에서 호출한다.
 * auth()는 CSRF 토큰과 세션 JWT를 새로 만들며 crypto.getRandomValues()를 부른다. auth() 안의 headers()만으로는
 * 미리 그리기(partialPrefetching의 세션별 앱 셸)에서 빠지지 않아 Next.js가 그 값을 미리 그리기 오류로 잡으므로,
 * connection()으로 요청 시점에만 읽게 한다.
 */
export async function readSession() {
  await connection();
  return auth();
}

/** 세션을 읽으므로 반드시 Suspense 경계 안에서 호출한다. */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? session.user.email ?? "사용자",
    email: session.user.email ?? null,
  };
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}
