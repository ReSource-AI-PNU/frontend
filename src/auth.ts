import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { z } from "zod";
import {
  loginFailure,
  parseAccount,
  pickActiveOrg,
  safeRedirect,
  type LoginFailure,
  type Membership,
} from "@/lib/auth/account";
import { backendConfig, BackendError, callBackend } from "@/lib/server/backend";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** 이 사람이 속한 회사들(백엔드 계정의 멤버십) */
    memberships: Membership[];
    /** 지금 보는 회사. 소속 목록 안에서만 고를 수 있다 */
    activeOrgId: string | null;
  }
  interface User {
    memberships?: Membership[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    memberships?: Membership[];
    activeOrgId?: string | null;
  }
}

/** 로그인해야 들어갈 수 있는 경로. proxy.ts가 낙관적으로 먼저 거른다. 초대(/invite)와 체험하기(/demo)는 열려 있다. */
export const PROTECTED_PREFIXES = ["/onboarding", "/settings", "/app"];

/** Microsoft 로그인은 세 값을 모두 넣었을 때만 켠다. 꺼져 있으면 버튼도 그리지 않는다. */
export const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
);

/**
 * 로컬 개발·E2E용 로그인(이름과 이메일만, 비밀번호 없음). AUTH_DEV_LOGIN=true이고 백엔드가 bff 모드가 아닐 때만 켠다.
 * bff는 운영 모드이므로 운영 배포에서는 어떤 경우에도 켜지지 않는다. 들어오면 백엔드의 모든 회사(GET /orgs, header 모드)에
 * 소속된 것으로 보고 사이드바에서 회사를 바꿔 가며 양쪽을 시험한다.
 */
const backend = backendConfig();
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "true" && !(backend.ok && backend.mode === "bff");

/** 로그인 실패. code는 로그인 화면의 ?code=와 서버 액션에서 문구를 고르는 데 쓴다. */
export class LoginFailed extends CredentialsSignin {
  constructor(readonly reason: LoginFailure) {
    super(reason);
    this.code = reason;
  }
}

const passwordCredentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

const devCredentials = z.object({
  name: z.string().trim().min(1).max(40),
  email: z.email(),
});

/** 개발용 계정의 소속: header 모드 백엔드의 모든 회사. 백엔드에 닿지 못하면 빈 목록(회사 등록으로 간다). */
async function devMemberships(): Promise<Membership[]> {
  try {
    const orgs = await callBackend<{ id: string; name: string; role: Membership["kind"]; order?: number }[]>("/orgs");
    return [...orgs]
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .map((org) => ({ orgId: org.id, orgName: org.name, kind: org.role, memberRole: "owner" as const }));
  } catch {
    return [];
  }
}

/** 세션을 바꿀 때(회사 등록, 초대 수락, 회사 바꾸기) 소속을 백엔드에서 다시 읽는다. 실패하면 null(있던 값을 둔다). */
async function freshAccount(userId: string | undefined): Promise<{ name?: string; memberships: Membership[] } | null> {
  if (!userId) return null;
  if (userId.startsWith("dev:")) return devLoginEnabled ? { memberships: await devMemberships() } : null;
  try {
    const account = parseAccount(await callBackend("/accounts/me", { userId }));
    return account ? { name: account.user.name, memberships: account.memberships } : null;
  } catch {
    return null;
  }
}

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    name: "이메일",
    credentials: { email: {}, password: {} },
    async authorize(raw) {
      const parsed = passwordCredentials.safeParse(raw);
      if (!parsed.success) throw new LoginFailed("invalid");
      try {
        const account = parseAccount(
          await callBackend("/accounts/login", { method: "POST", body: { email: parsed.data.email, password: parsed.data.password } }),
        );
        if (!account) throw new LoginFailed("unavailable");
        return { id: account.user.id, name: account.user.name, email: account.user.email, memberships: account.memberships };
      } catch (error) {
        if (error instanceof LoginFailed) throw error;
        throw new LoginFailed(error instanceof BackendError ? loginFailure(error.status) : "unavailable");
      }
    },
  }),
];

if (entraConfigured) {
  // Entra External ID: issuer = https://<subdomain>.ciamlogin.com/<tenant-id>/v2.0
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  );
}

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "개발용 로그인",
      credentials: { name: {}, email: {} },
      async authorize(raw) {
        const parsed = devCredentials.safeParse(raw);
        if (!parsed.success) return null;
        const { name, email } = parsed.data;
        return { id: `dev:${email.toLowerCase()}`, name, email, memberships: await devMemberships() };
      },
    }),
  );
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const loggedIn = Boolean(session?.user);
      if (isProtected(nextUrl.pathname)) return loggedIn;
      if (loggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
        return Response.redirect(new URL(safeRedirect(nextUrl.searchParams.get("callbackUrl"), "/app"), nextUrl));
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
        token.userId = user.id;
        token.memberships = user.memberships ?? [];
        token.activeOrgId = pickActiveOrg(token.memberships, null);
      }
      if (trigger === "update") {
        // 바꿀 회사만 받는다. 소속은 브라우저가 보낸 값이 아니라 백엔드에서 다시 읽은 값만 쓴다
        const fresh = await freshAccount(token.userId ?? token.sub);
        if (fresh) {
          token.memberships = fresh.memberships;
          if (fresh.name) token.name = fresh.name;
        }
        const wanted =
          session && typeof session === "object" && typeof (session as { activeOrgId?: unknown }).activeOrgId === "string"
            ? (session as { activeOrgId: string }).activeOrgId
            : (token.activeOrgId ?? null);
        token.activeOrgId = pickActiveOrg(token.memberships ?? [], wanted);
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId ?? token.sub ?? "";
      session.memberships = token.memberships ?? [];
      session.activeOrgId = token.activeOrgId ?? null;
      return session;
    },
  },
});
