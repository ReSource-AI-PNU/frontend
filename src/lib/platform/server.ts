import "server-only";
import { auth } from "@/auth";
import { headers } from "next/headers";
import type { Organization } from "@/lib/domain";

export type Identity = {
  userId: string;
  organizations: Organization[];
  memberships: { orgId: string; role: string; userId: string; id: string }[];
};
export async function localPlatformDemo() {
  const host = (await headers()).get("host") ?? "";
  return (
    process.env.PLATFORM_DEMO === "true" &&
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  );
}
export async function backendForUser<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const user = (await auth())?.user;
  if (!user?.id) throw new Error("로그인이 필요합니다");
  const response = await fetch(
    `${process.env.PLATFORM_API_URL}/api/v1/${path}`,
    {
      method: method ?? (body === undefined ? "GET" : "POST"),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PLATFORM_SERVICE_KEY}`,
        "X-User-Id": user.id,
        "X-User-Email": user.email ?? "",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "회사 등록 정보를 확인하세요",
    );
  return data as T;
}
