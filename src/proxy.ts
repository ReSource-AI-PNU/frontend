// 쿠키의 세션만 보고 판단하는 낙관적 검사. 실제 권한 확인은 lib/server/session.ts에서 한다.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|data|fonts|favicon.ico|.*\\.(?:png|jpg|svg|geojson|json|woff2)$).*)"],
};
