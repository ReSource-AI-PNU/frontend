import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type CurrentUser = { id: string; name: string; email: string | null };

/** 세션을 읽으므로 반드시 Suspense 경계 안에서 호출한다. */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await auth();
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
