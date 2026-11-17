/** 로그인해야 들어갈 수 있는 경로. 초대(/invite)와 체험하기(/demo)는 열려 있다. */
export const PROTECTED_PREFIXES = ["/onboarding", "/settings", "/app"];

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Auth.js 세션 쿠키 이름(https에서는 __Secure- 접두어, 크면 .0 .1로 나뉜다) */
export function hasSessionCookie(names: string[]): boolean {
  return names.some((name) => /^(__Secure-)?authjs\.session-token(\.\d+)?$/.test(name));
}
