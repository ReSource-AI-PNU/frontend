/**
 * 쿠키가 있는지만 보는 낙관적 검사. 실제 확인은 서버 컴포넌트(src/lib/server/workspace.ts)와 통로(src/app/api/v3)에서 한다.
 *
 * Auth.js의 미들웨어(auth)를 쓰지 않는 까닭: 그것은 요청마다 세션 쿠키를 다시 서명해 내려보낸다. 회사를 등록하거나 바꿔
 * 세션을 고치는 동안 옛 쿠키로 떠난 미리 가져오기(prefetch) 응답이 늦게 오면, 고친 세션을 옛 세션으로 덮어 버린다.
 * 여기서는 쿠키를 쓰지 않으므로 세션 쿠키는 로그인·로그아웃과 세션 고치기(서버 액션)만 쓴다.
 */
import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, isProtected } from "@/lib/auth/routes";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();
  if (hasSessionCookie(request.cookies.getAll().map((cookie) => cookie.name))) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|data|fonts|favicon.ico|.*\\.(?:png|jpg|webp|svg|geojson|json|woff2)$).*)"],
};
