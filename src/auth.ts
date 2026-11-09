import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { z } from "zod";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/** 로그인해야 들어갈 수 있는 경로. proxy.ts가 낙관적으로 먼저 거른다. */
export const PROTECTED_PREFIXES = [
  "/upload", "/session", "/complex", "/dashboard", "/onboarding",
  "/knowledge", "/vendor", "/admin", "/settings",
];

export const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
);

/** 로컬·시연용 로그인. 운영 배포에서는 반드시 끈다. */
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "true";

const devCredentials = z.object({
  name: z.string().trim().min(1).max(40),
  email: z.email(),
});

const providers: Provider[] = [];

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
      authorize(raw) {
        const parsed = devCredentials.safeParse(raw);
        if (!parsed.success) return null;
        const { name, email } = parsed.data;
        return { id: `dev:${email.toLowerCase()}`, name, email };
      },
    }),
  );
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const loggedIn = Boolean(session?.user);
      if (isProtected(nextUrl.pathname)) return loggedIn;
      if (loggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
        return Response.redirect(new URL("/upload", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
